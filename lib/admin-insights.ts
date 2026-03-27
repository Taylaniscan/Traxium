import { Prisma } from "@prisma/client";

import { getAnalyticsInsightCutoffs } from "@/lib/analytics";
import {
  getOrganizationAuditInsights,
  type OrganizationAuditEvent,
} from "@/lib/audit";
import { getScopedCachedValue } from "@/lib/cache";
import { prisma } from "@/lib/prisma";

const adminInsightsOrganizationSelect = {
  id: true,
  name: true,
  slug: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrganizationSelect;

type AdminInsightsOrganizationRecord = Prisma.OrganizationGetPayload<{
  select: typeof adminInsightsOrganizationSelect;
}>;

const ADMIN_INSIGHTS_CACHE_TTL_MS = 2_000;

export class AdminInsightsError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 422 = 400
  ) {
    super(message);
    this.name = "AdminInsightsError";
  }
}

export type OrganizationAdminInsights = {
  organization: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  };
  metrics: {
    totalMembers: number;
    pendingInvites: number;
    invitesSentLast7Days: number;
    invitesSentLast30Days: number;
    acceptedInvites: number;
    liveSavingCards: number;
    recentErrorEventsLast7Days: number;
    recentCriticalAdminActionsLast7Days: number;
  };
  signals: {
    workspaceCreatedAt: Date;
    firstValueReached: boolean;
    firstValueAt: Date | null;
    firstValueSource: "saving_card" | null;
    lastInviteSentAt: Date | null;
    lastAcceptedInviteAt: Date | null;
    lastSavingCardActivityAt: Date | null;
  };
  recentAdminActions: OrganizationAuditEvent[];
  recentCriticalAdminActions: OrganizationAuditEvent[];
};

function normalizeOrganizationId(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new AdminInsightsError("Organization context is required.", 422);
  }

  return normalized;
}

function mapOrganization(
  organization: AdminInsightsOrganizationRecord
): OrganizationAdminInsights["organization"] {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };
}

function readGroupedCount(
  count:
    | {
        _all?: number;
      }
    | true
    | null
    | undefined
) {
  if (!count || count === true) {
    return 0;
  }

  return count._all ?? 0;
}

export async function getOrganizationAdminInsights(
  organizationId: string
): Promise<OrganizationAdminInsights> {
  const normalizedOrganizationId = normalizeOrganizationId(organizationId);
  return getScopedCachedValue(
    {
      namespace: "admin-insights",
      organizationId: normalizedOrganizationId,
      ttlMs: ADMIN_INSIGHTS_CACHE_TTL_MS,
    },
    async () => {
      const { last7Days, last30Days } = getAnalyticsInsightCutoffs();

      const [
        [
          organization,
          totalMembers,
          invitationCountsByStatus,
          invitesSentLast7Days,
          invitesSentLast30Days,
          latestInvitation,
          latestAcceptedInvitation,
          savingCardMetrics,
        ],
        auditInsights,
      ] = await Promise.all([
        prisma.$transaction([
          prisma.organization.findUnique({
            where: {
              id: normalizedOrganizationId,
            },
            select: adminInsightsOrganizationSelect,
          }),
          prisma.organizationMembership.count({
            where: {
              organizationId: normalizedOrganizationId,
            },
          }),
          prisma.invitation.groupBy({
            by: ["status"],
            where: {
              organizationId: normalizedOrganizationId,
              status: {
                in: ["PENDING", "ACCEPTED"],
              },
            },
            orderBy: {
              status: "asc",
            },
            _count: {
              _all: true,
            },
          }),
          prisma.invitation.count({
            where: {
              organizationId: normalizedOrganizationId,
              createdAt: {
                gte: last7Days,
              },
            },
          }),
          prisma.invitation.count({
            where: {
              organizationId: normalizedOrganizationId,
              createdAt: {
                gte: last30Days,
              },
            },
          }),
          prisma.invitation.aggregate({
            where: {
              organizationId: normalizedOrganizationId,
            },
            _max: {
              createdAt: true,
            },
          }),
          prisma.invitation.aggregate({
            where: {
              organizationId: normalizedOrganizationId,
              status: "ACCEPTED",
            },
            _max: {
              updatedAt: true,
            },
          }),
          prisma.savingCard.aggregate({
            where: {
              organizationId: normalizedOrganizationId,
            },
            _count: {
              _all: true,
            },
            _min: {
              createdAt: true,
            },
            _max: {
              updatedAt: true,
            },
          }),
        ]),
        getOrganizationAuditInsights(normalizedOrganizationId),
      ]);

      if (!organization) {
        throw new AdminInsightsError("Organization not found.", 404);
      }

      const pendingInvites =
        readGroupedCount(
          invitationCountsByStatus.find((entry) => entry.status === "PENDING")
            ?._count
        );
      const acceptedInvites =
        readGroupedCount(
          invitationCountsByStatus.find((entry) => entry.status === "ACCEPTED")
            ?._count
        );
      const liveSavingCards = readGroupedCount(savingCardMetrics._count);
      const firstValueAt = savingCardMetrics._min.createdAt ?? null;
      const lastSavingCardActivityAt = savingCardMetrics._max.updatedAt ?? null;

      return {
        organization: mapOrganization(organization),
        metrics: {
          totalMembers,
          pendingInvites,
          invitesSentLast7Days,
          invitesSentLast30Days,
          acceptedInvites,
          liveSavingCards,
          recentErrorEventsLast7Days:
            auditInsights.metrics.recentErrorEventsLast7Days,
          recentCriticalAdminActionsLast7Days:
            auditInsights.metrics.recentCriticalAdminActionsLast7Days,
        },
        signals: {
          workspaceCreatedAt: organization.createdAt,
          firstValueReached: firstValueAt !== null,
          firstValueAt,
          firstValueSource: firstValueAt ? "saving_card" : null,
          lastInviteSentAt: latestInvitation._max.createdAt ?? null,
          lastAcceptedInviteAt: latestAcceptedInvitation._max.updatedAt ?? null,
          lastSavingCardActivityAt,
        },
        recentAdminActions: auditInsights.recentAdminActions,
        recentCriticalAdminActions: auditInsights.recentCriticalAdminActions,
      };
    }
  );
}
