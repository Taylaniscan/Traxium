import { Prisma } from "@prisma/client";

import { getAnalyticsInsightCutoffs } from "@/lib/analytics";
import {
  getOrganizationAuditInsights,
  type OrganizationAuditEvent,
} from "@/lib/audit";
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

export async function getOrganizationAdminInsights(
  organizationId: string
): Promise<OrganizationAdminInsights> {
  const normalizedOrganizationId = normalizeOrganizationId(organizationId);
  const { last7Days, last30Days } = getAnalyticsInsightCutoffs();

  const [
    organization,
    totalMembers,
    pendingInvites,
    invitesSentLast7Days,
    invitesSentLast30Days,
    acceptedInvites,
    liveSavingCards,
    firstSavingCard,
    lastInviteSent,
    lastAcceptedInvite,
    lastSavingCardActivity,
    auditInsights,
  ] = await Promise.all([
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
    prisma.invitation.count({
      where: {
        organizationId: normalizedOrganizationId,
        status: "PENDING",
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
    prisma.invitation.count({
      where: {
        organizationId: normalizedOrganizationId,
        status: "ACCEPTED",
      },
    }),
    prisma.savingCard.count({
      where: {
        organizationId: normalizedOrganizationId,
      },
    }),
    prisma.savingCard.findFirst({
      where: {
        organizationId: normalizedOrganizationId,
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.invitation.findFirst({
      where: {
        organizationId: normalizedOrganizationId,
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.invitation.findFirst({
      where: {
        organizationId: normalizedOrganizationId,
        status: "ACCEPTED",
      },
      select: {
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.savingCard.findFirst({
      where: {
        organizationId: normalizedOrganizationId,
      },
      select: {
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    getOrganizationAuditInsights(normalizedOrganizationId),
  ]);

  if (!organization) {
    throw new AdminInsightsError("Organization not found.", 404);
  }

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
      firstValueReached: Boolean(firstSavingCard),
      firstValueAt: firstSavingCard?.createdAt ?? null,
      firstValueSource: firstSavingCard ? "saving_card" : null,
      lastInviteSentAt: lastInviteSent?.createdAt ?? null,
      lastAcceptedInviteAt: lastAcceptedInvite?.updatedAt ?? null,
      lastSavingCardActivityAt: lastSavingCardActivity?.updatedAt ?? null,
    },
    recentAdminActions: auditInsights.recentAdminActions,
    recentCriticalAdminActions: auditInsights.recentCriticalAdminActions,
  };
}
