import { Prisma } from "@prisma/client";

import { sanitizeForLog } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const auditEventTypes = {
  MEMBER_ROLE_CHANGED: "member.role_changed",
  MEMBER_REMOVED: "member.removed",
  INVITE_CREATED: "invite.created",
  INVITE_REVOKED: "invite.revoked",
  INVITE_RESENT: "invite.resent",
  WORKSPACE_UPDATED: "workspace.updated",
  ONBOARDING_WORKSPACE_CREATED: "onboarding.workspace_created",
} as const;

export type AuditEventType =
  (typeof auditEventTypes)[keyof typeof auditEventTypes];

export const organizationAuditEventTypes = Object.values(
  auditEventTypes
) as AuditEventType[];

export const criticalAdminAuditEventTypes = [
  auditEventTypes.MEMBER_ROLE_CHANGED,
  auditEventTypes.MEMBER_REMOVED,
  auditEventTypes.INVITE_REVOKED,
  auditEventTypes.WORKSPACE_UPDATED,
  auditEventTypes.ONBOARDING_WORKSPACE_CREATED,
] as const satisfies readonly AuditEventType[];

const legacyAdminAuditActionMap = {
  "membership.role_updated": auditEventTypes.MEMBER_ROLE_CHANGED,
  "membership.removed": auditEventTypes.MEMBER_REMOVED,
  "invitation.created": auditEventTypes.INVITE_CREATED,
  "invitation.revoked": auditEventTypes.INVITE_REVOKED,
  "invitation.resent": auditEventTypes.INVITE_RESENT,
  "workspace.settings_updated": auditEventTypes.WORKSPACE_UPDATED,
} as const satisfies Record<string, AuditEventType>;

const legacyCriticalAdminAuditActions = [
  "membership.role_updated",
  "membership.removed",
  "invitation.revoked",
  "workspace.settings_updated",
] as const;

const organizationAuditEventSelect = {
  id: true,
  organizationId: true,
  userId: true,
  actorUserId: true,
  targetUserId: true,
  targetEntityId: true,
  eventType: true,
  action: true,
  detail: true,
  payload: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.AuditLogSelect;

type OrganizationAuditEventRecord = Prisma.AuditLogGetPayload<{
  select: typeof organizationAuditEventSelect;
}>;

type AuditWriteClient = Pick<typeof prisma, "auditLog">;

export class AuditEventError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 422 = 400
  ) {
    super(message);
    this.name = "AuditEventError";
  }
}

export type OrganizationAuditEvent = {
  id: string;
  organizationId: string;
  eventType: AuditEventType | string;
  action: AuditEventType | string;
  detail: string;
  createdAt: Date;
  actorUserId: string | null;
  targetUserId: string | null;
  targetEntityId: string | null;
  payload: Record<string, unknown> | null;
  actor: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export type WriteAuditEventInput = {
  organizationId: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  targetEntityId?: string | null;
  eventType: AuditEventType;
  detail: string;
  payload?: Record<string, unknown> | null;
};

export type OrganizationAuditInsights = {
  recentAdminActions: OrganizationAuditEvent[];
  recentCriticalAdminActions: OrganizationAuditEvent[];
  metrics: {
    recentCriticalAdminActionsLast7Days: number;
    recentErrorEventsLast7Days: number;
  };
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function normalizeOrganizationId(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new AuditEventError("Organization context is required.", 422);
  }

  return normalized;
}

function normalizeDetail(detail: string) {
  const normalized = detail.trim();

  if (!normalized) {
    throw new AuditEventError("Audit event detail is required.", 422);
  }

  return normalized;
}

function sanitizeAuditPayload(
  payload: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (!payload) {
    return undefined;
  }

  const sanitized = sanitizeForLog(payload);

  if (!isPlainObject(sanitized)) {
    return undefined;
  }

  if (!Object.keys(sanitized).length) {
    return undefined;
  }

  return sanitized as Prisma.InputJsonValue;
}

function mapLegacyAuditActionToEventType(action: string) {
  return legacyAdminAuditActionMap[action as keyof typeof legacyAdminAuditActionMap] ?? null;
}

function normalizeAuditPayloadForResponse(
  payload: Prisma.JsonValue | null
): Record<string, unknown> | null {
  if (!payload || !isPlainObject(payload)) {
    return null;
  }

  return payload;
}

function mapOrganizationAuditEvent(
  auditEvent: OrganizationAuditEventRecord
): OrganizationAuditEvent {
  const resolvedEventType =
    auditEvent.eventType ??
    mapLegacyAuditActionToEventType(auditEvent.action) ??
    auditEvent.action;

  return {
    id: auditEvent.id,
    organizationId: auditEvent.organizationId ?? "",
    eventType: resolvedEventType,
    action: resolvedEventType,
    detail: auditEvent.detail,
    createdAt: auditEvent.createdAt,
    actorUserId: auditEvent.actorUserId ?? auditEvent.userId ?? null,
    targetUserId: auditEvent.targetUserId ?? null,
    targetEntityId: auditEvent.targetEntityId ?? null,
    payload: normalizeAuditPayloadForResponse(auditEvent.payload),
    actor: auditEvent.user,
  };
}

function clampTake(value: number, fallback: number) {
  return Math.max(1, Math.min(Math.trunc(value) || fallback, 100));
}

function buildCriticalAuditWhere(
  organizationId: string,
  since: Date
): Prisma.AuditLogWhereInput {
  return {
    organizationId,
    createdAt: {
      gte: since,
    },
    OR: [
      {
        eventType: {
          in: [...criticalAdminAuditEventTypes],
        },
      },
      {
        action: {
          in: [
            ...criticalAdminAuditEventTypes,
            ...legacyCriticalAdminAuditActions,
          ],
        },
      },
    ],
  };
}

function buildErrorAuditWhere(
  organizationId: string,
  since: Date
): Prisma.AuditLogWhereInput {
  return {
    organizationId,
    createdAt: {
      gte: since,
    },
    OR: [
      {
        eventType: {
          endsWith: ".failed",
        },
      },
      {
        eventType: {
          endsWith: ".error",
        },
      },
      {
        action: {
          endsWith: ".failed",
        },
      },
      {
        action: {
          endsWith: ".error",
        },
      },
    ],
  };
}

export async function writeAuditEvent(
  client: AuditWriteClient,
  input: WriteAuditEventInput
) {
  const organizationId = normalizeOrganizationId(input.organizationId);
  const detail = normalizeDetail(input.detail);

  await client.auditLog.create({
    data: {
      organizationId,
      userId: input.actorUserId ?? null,
      actorUserId: input.actorUserId ?? null,
      targetUserId: input.targetUserId ?? null,
      targetEntityId: input.targetEntityId ?? null,
      eventType: input.eventType,
      action: input.eventType,
      detail,
      payload: sanitizeAuditPayload(input.payload),
    },
  });
}

export async function listAuditEventsForOrganization(
  organizationId: string,
  take = 20
): Promise<OrganizationAuditEvent[]> {
  const normalizedOrganizationId = normalizeOrganizationId(organizationId);
  const normalizedTake = clampTake(take, 20);

  const auditEvents = await prisma.auditLog.findMany({
    where: {
      organizationId: normalizedOrganizationId,
      OR: [
        {
          eventType: {
            in: organizationAuditEventTypes,
          },
        },
        {
          action: {
            in: [
              ...organizationAuditEventTypes,
              ...Object.keys(legacyAdminAuditActionMap),
            ],
          },
        },
      ],
    },
    select: organizationAuditEventSelect,
    orderBy: [{ createdAt: "desc" }],
    take: normalizedTake,
  });

  return auditEvents.map(mapOrganizationAuditEvent);
}

export async function getOrganizationAuditInsights(
  organizationId: string,
  options: {
    recentTake?: number;
    criticalTake?: number;
    sinceDays?: number;
  } = {}
): Promise<OrganizationAuditInsights> {
  const normalizedOrganizationId = normalizeOrganizationId(organizationId);
  const recentTake = clampTake(options.recentTake ?? 6, 6);
  const criticalTake = clampTake(options.criticalTake ?? 5, 5);
  const sinceDays = Math.max(1, Math.trunc(options.sinceDays ?? 7) || 7);
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const criticalAuditWhere = buildCriticalAuditWhere(
    normalizedOrganizationId,
    since
  );

  const [
    recentAdminActions,
    recentCriticalAdminActions,
    recentCriticalAdminActionsLast7Days,
    recentErrorEventsLast7Days,
  ] = await Promise.all([
    listAuditEventsForOrganization(normalizedOrganizationId, recentTake),
    prisma.auditLog.findMany({
      where: criticalAuditWhere,
      select: organizationAuditEventSelect,
      orderBy: [{ createdAt: "desc" }],
      take: criticalTake,
    }),
    prisma.auditLog.count({
      where: criticalAuditWhere,
    }),
    prisma.auditLog.count({
      where: buildErrorAuditWhere(normalizedOrganizationId, since),
    }),
  ]);

  return {
    recentAdminActions,
    recentCriticalAdminActions: recentCriticalAdminActions.map(
      mapOrganizationAuditEvent
    ),
    metrics: {
      recentCriticalAdminActionsLast7Days,
      recentErrorEventsLast7Days,
    },
  };
}
