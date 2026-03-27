import crypto from "node:crypto";
import type {
  InvitationStatus,
  MembershipStatus,
  OrganizationRole,
  Prisma,
} from "@prisma/client";

import { auditEventTypes, writeAuditEvent } from "@/lib/audit";
import { analyticsEventNames, trackEvent } from "@/lib/analytics";
import {
  deliverOrganizationInvitationEmail,
  queueInvitationEmailJobSafely,
  type HostedInvitationDeliveryResult,
  type QueueUnavailableDeliveryResult,
  type QueuedDeliveryResult,
} from "@/lib/auth-email";
import {
  canAssignOrganizationRole,
  canManageOrganizationMembers,
} from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { buildTenantScopeWhere } from "@/lib/tenant-scope";
import {
  organizationInvitationSelect,
  type AuthenticatedUser,
  type OrganizationInvitationRecord,
} from "@/lib/types";

const ACTIVE_MEMBERSHIP_STATUS: MembershipStatus = "ACTIVE";
const INVITATION_STATUS_ACCEPTED: InvitationStatus = "ACCEPTED";
const INVITATION_STATUS_EXPIRED: InvitationStatus = "EXPIRED";
const INVITATION_STATUS_PENDING: InvitationStatus = "PENDING";
const INVITATION_STATUS_REVOKED: InvitationStatus = "REVOKED";
const DEFAULT_INVITATION_TTL_DAYS = 7;

type InvitationWriteClient = Prisma.TransactionClient;
const invitationMembershipSelect = {
  id: true,
  organizationId: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrganizationMembershipSelect;

export type InvitationAcceptanceResult = {
  invitation: OrganizationInvitationRecord;
  membership: Prisma.OrganizationMembershipGetPayload<{
    select: typeof invitationMembershipSelect;
  }>;
  activeOrganizationId: string;
};

export type InvitationDeliveryResult =
  | HostedInvitationDeliveryResult
  | QueuedDeliveryResult
  | QueueUnavailableDeliveryResult;

export type InvitationCreationResult = {
  invitation: OrganizationInvitationRecord;
  delivery: InvitationDeliveryResult;
};

export type InvitationLifecycleResult = {
  changed: boolean;
  invitation: OrganizationInvitationRecord;
};

export type InvitationResendResult = {
  invitation: OrganizationInvitationRecord;
  delivery: InvitationDeliveryResult;
};

export class InvitationError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 410 | 422 = 400
  ) {
    super(message);
    this.name = "InvitationError";
  }
}

function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase();
}

function createInvitationToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createInvitationExpiryDate(now = new Date()) {
  return new Date(now.getTime() + DEFAULT_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function normalizeInvitationToken(token: string) {
  return token.trim();
}

function formatInvitationRoleLabel(role: OrganizationRole) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isExpiredInvitation(invitation: Pick<OrganizationInvitationRecord, "status" | "expiresAt">) {
  return (
    invitation.status === INVITATION_STATUS_PENDING &&
    invitation.expiresAt.getTime() <= Date.now()
  );
}

function assertInvitationManagementAccess(
  actor: AuthenticatedUser,
  targetRole: OrganizationRole
) {
  const actorRole = actor.activeOrganization.membershipRole;

  if (!canManageOrganizationMembers(actorRole)) {
    throw new InvitationError("Forbidden.", 403);
  }

  if (!canAssignOrganizationRole(actorRole, targetRole)) {
    throw new InvitationError("Forbidden.", 403);
  }
}

function buildInvitationDeliveryQueueIdempotencyKey(
  invitation: Pick<OrganizationInvitationRecord, "id" | "updatedAt">,
  sendKind: "created" | "resent"
) {
  return [
    "invitation-delivery",
    invitation.id,
    sendKind,
    invitation.updatedAt.toISOString(),
  ].join(":");
}

function getDeliveryChannelForPayload(delivery: InvitationDeliveryResult) {
  return "channel" in delivery ? delivery.channel : null;
}

function getDeliveryTransportForPayload(delivery: InvitationDeliveryResult) {
  return delivery.transport;
}

function getManualDeliveryFlag(delivery: InvitationDeliveryResult) {
  return "requiresManualDelivery" in delivery
    ? delivery.requiresManualDelivery ?? false
    : false;
}

async function expirePendingInvitations(
  tx: InvitationWriteClient,
  organizationId: string,
  email: string,
  now: Date
) {
  await tx.invitation.updateMany({
    where: {
      organizationId,
      email,
      status: INVITATION_STATUS_PENDING,
      expiresAt: {
        lt: now,
      },
    },
    data: {
      status: INVITATION_STATUS_EXPIRED,
    },
  });
}

async function findActiveOrganizationMemberByEmail(
  tx: InvitationWriteClient,
  organizationId: string,
  email: string
) {
  return tx.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
      memberships: {
        some: {
          organizationId,
          status: ACTIVE_MEMBERSHIP_STATUS,
        },
      },
    },
    select: {
      id: true,
    },
  });
}

async function findInvitationByToken(
  tx: InvitationWriteClient,
  token: string
): Promise<OrganizationInvitationRecord | null> {
  const normalizedToken = normalizeInvitationToken(token);

  if (!normalizedToken) {
    return null;
  }

  const invitation = await tx.invitation.findUnique({
    where: {
      token: normalizedToken,
    },
    select: organizationInvitationSelect,
  });

  if (!invitation) {
    return null;
  }

  if (!isExpiredInvitation(invitation)) {
    return invitation;
  }

  return tx.invitation.update({
    where: {
      id: invitation.id,
    },
    data: {
      status: INVITATION_STATUS_EXPIRED,
    },
    select: organizationInvitationSelect,
  });
}

async function findInvitationById(
  tx: InvitationWriteClient,
  invitationId: string
): Promise<OrganizationInvitationRecord | null> {
  const normalizedInvitationId = invitationId.trim();

  if (!normalizedInvitationId) {
    return null;
  }

  const invitation = await tx.invitation.findUnique({
    where: {
      id: normalizedInvitationId,
    },
    select: organizationInvitationSelect,
  });

  if (!invitation) {
    return null;
  }

  if (!isExpiredInvitation(invitation)) {
    return invitation;
  }

  return tx.invitation.update({
    where: {
      id: invitation.id,
    },
    data: {
      status: INVITATION_STATUS_EXPIRED,
    },
    select: organizationInvitationSelect,
  });
}

export async function createOrganizationInvitation(
  actor: AuthenticatedUser,
  input: {
    email: string;
    role: OrganizationRole;
  },
  options: {
    deliveryMode?: "sync" | "async";
  } = {}
): Promise<InvitationCreationResult> {
  const email = normalizeInvitationEmail(input.email);
  const deliveryMode = options.deliveryMode ?? "sync";
  assertInvitationManagementAccess(actor, input.role);

  const invitation = await prisma.$transaction(async (tx) => {
    const now = new Date();

    await expirePendingInvitations(tx, actor.organizationId, email, now);

    const existingMember = await findActiveOrganizationMemberByEmail(
      tx,
      actor.organizationId,
      email
    );

    if (existingMember) {
      throw new InvitationError(
        "This email address is already an active member of the workspace.",
        409
      );
    }

    await tx.invitation.updateMany({
      where: buildTenantScopeWhere(actor, {
        email,
        status: INVITATION_STATUS_PENDING,
        expiresAt: {
          gte: now,
        },
      }),
      data: {
        status: INVITATION_STATUS_REVOKED,
      },
    });

    return tx.invitation.create({
      data: {
        organizationId: actor.organizationId,
        email,
        role: input.role,
        token: createInvitationToken(),
        status: INVITATION_STATUS_PENDING,
        expiresAt: createInvitationExpiryDate(now),
        invitedByUserId: actor.id,
      },
      select: organizationInvitationSelect,
    });
  });

  const delivery =
    deliveryMode === "async"
      ? await queueInvitationEmailJobSafely({
          invitationId: invitation.id,
          organizationId: actor.organizationId,
          idempotencyKey: buildInvitationDeliveryQueueIdempotencyKey(
            invitation,
            "created"
          ),
        })
      : await deliverOrganizationInvitationEmail(invitation);

  await writeAuditEvent(prisma, {
    organizationId: actor.organizationId,
    actorUserId: actor.id,
    targetEntityId: invitation.id,
    eventType: auditEventTypes.INVITE_CREATED,
    detail: `Created a ${formatInvitationRoleLabel(invitation.role)} invitation.`,
    payload: {
      invitationRole: invitation.role,
      deliveryChannel: getDeliveryChannelForPayload(delivery),
      deliveryTransport: getDeliveryTransportForPayload(delivery),
      requiresManualDelivery: getManualDeliveryFlag(delivery),
    },
  });

  await trackEvent({
    event: analyticsEventNames.INVITATION_SENT,
    organizationId: actor.organizationId,
    userId: actor.id,
    properties: {
      invitationId: invitation.id,
      invitationRole: invitation.role,
      deliveryChannel: getDeliveryChannelForPayload(delivery),
      deliveryTransport: getDeliveryTransportForPayload(delivery),
      requiresManualDelivery: getManualDeliveryFlag(delivery),
      sendKind: "created",
    },
  });

  return {
    invitation,
    delivery,
  };
}

export async function getInvitationByToken(
  token: string
): Promise<OrganizationInvitationRecord | null> {
  return findInvitationByToken(prisma, token);
}

export async function revokeOrganizationInvitation(input: {
  actor: AuthenticatedUser;
  invitationId: string;
}): Promise<InvitationLifecycleResult> {
  const invitationId = input.invitationId.trim();
  const organizationId = input.actor.activeOrganization.organizationId;

  if (!invitationId) {
    throw new InvitationError("Invitation id is required.", 422);
  }

  return prisma.$transaction(async (tx) => {
    const invitation = await findInvitationById(tx, invitationId);

    if (!invitation || invitation.organizationId !== organizationId) {
      throw new InvitationError("Invitation not found in the active organization.", 404);
    }

    assertInvitationManagementAccess(input.actor, invitation.role);

    if (invitation.status === INVITATION_STATUS_ACCEPTED) {
      throw new InvitationError(
        "Accepted invitations cannot be revoked.",
        409
      );
    }

    if (invitation.status === INVITATION_STATUS_EXPIRED) {
      throw new InvitationError(
        "Expired invitations do not need cancellation. Resend to issue a fresh invite.",
        409
      );
    }

    if (invitation.status === INVITATION_STATUS_REVOKED) {
      return {
        changed: false,
        invitation,
      };
    }

    const updatedInvitation = await tx.invitation.update({
      where: {
        id: invitation.id,
      },
      data: {
        status: INVITATION_STATUS_REVOKED,
      },
      select: organizationInvitationSelect,
    });

    await writeAuditEvent(tx, {
      organizationId,
      actorUserId: input.actor.id,
      targetEntityId: updatedInvitation.id,
      eventType: auditEventTypes.INVITE_REVOKED,
      detail: "Cancelled a pending invitation.",
      payload: {
        invitationRole: updatedInvitation.role,
        status: updatedInvitation.status,
      },
    });

    return {
      changed: true,
      invitation: updatedInvitation,
    };
  });
}

export async function resendOrganizationInvitation(input: {
  actor: AuthenticatedUser;
  invitationId: string;
}, options: {
  deliveryMode?: "sync" | "async";
} = {}): Promise<InvitationResendResult> {
  const invitationId = input.invitationId.trim();
  const organizationId = input.actor.activeOrganization.organizationId;
  const deliveryMode = options.deliveryMode ?? "sync";

  if (!invitationId) {
    throw new InvitationError("Invitation id is required.", 422);
  }

  const invitation = await prisma.$transaction(async (tx) => {
    const existingInvitation = await findInvitationById(tx, invitationId);

    if (!existingInvitation || existingInvitation.organizationId !== organizationId) {
      throw new InvitationError("Invitation not found in the active organization.", 404);
    }

    assertInvitationManagementAccess(input.actor, existingInvitation.role);

    if (existingInvitation.status === INVITATION_STATUS_ACCEPTED) {
      throw new InvitationError(
        "This invitation has already been accepted.",
        409
      );
    }

    if (existingInvitation.status === INVITATION_STATUS_REVOKED) {
      throw new InvitationError(
        "This invitation has been revoked. Create a new invitation to send it again.",
        409
      );
    }

    const existingMember = await findActiveOrganizationMemberByEmail(
      tx,
      organizationId,
      existingInvitation.email
    );

    if (existingMember) {
      throw new InvitationError(
        "This email address is already an active member of the workspace.",
        409
      );
    }

    return tx.invitation.update({
      where: {
        id: existingInvitation.id,
      },
      data: {
        status: INVITATION_STATUS_PENDING,
        expiresAt: createInvitationExpiryDate(new Date()),
      },
      select: organizationInvitationSelect,
    });
  });

  const delivery =
    deliveryMode === "async"
      ? await queueInvitationEmailJobSafely({
          invitationId: invitation.id,
          organizationId,
          idempotencyKey: buildInvitationDeliveryQueueIdempotencyKey(
            invitation,
            "resent"
          ),
        })
      : await deliverOrganizationInvitationEmail(invitation);

  await writeAuditEvent(prisma, {
    organizationId,
    actorUserId: input.actor.id,
    targetEntityId: invitation.id,
    eventType: auditEventTypes.INVITE_RESENT,
    detail: "Resent a workspace invitation.",
    payload: {
      invitationRole: invitation.role,
      deliveryChannel: getDeliveryChannelForPayload(delivery),
      deliveryTransport: getDeliveryTransportForPayload(delivery),
      requiresManualDelivery: getManualDeliveryFlag(delivery),
    },
  });

  await trackEvent({
    event: analyticsEventNames.INVITATION_SENT,
    organizationId,
    userId: input.actor.id,
    properties: {
      invitationId: invitation.id,
      invitationRole: invitation.role,
      deliveryChannel: getDeliveryChannelForPayload(delivery),
      deliveryTransport: getDeliveryTransportForPayload(delivery),
      requiresManualDelivery: getManualDeliveryFlag(delivery),
      sendKind: "resent",
    },
  });

  return {
    invitation,
    delivery,
  };
}

export function getInvitationReadError(
  invitation: Pick<OrganizationInvitationRecord, "status">
) {
  switch (invitation.status) {
    case INVITATION_STATUS_ACCEPTED:
      return new InvitationError("This invitation has already been accepted.", 409);
    case INVITATION_STATUS_REVOKED:
      return new InvitationError("This invitation has been revoked.", 410);
    case INVITATION_STATUS_EXPIRED:
      return new InvitationError("This invitation has expired.", 410);
    default:
      return null;
  }
}

export async function acceptOrganizationInvitation(input: {
  token: string;
  userId: string;
  userEmail: string;
  activeOrganizationId: string | null;
  source?: "authenticated_user" | "invited_account_setup";
}): Promise<InvitationAcceptanceResult> {
  const normalizedEmail = normalizeInvitationEmail(input.userEmail);

  let trackedInvitationId: string | null = null;
  let trackedInvitationRole: OrganizationRole | null = null;
  let trackedOrganizationId: string | null = null;

  const result = await prisma.$transaction(async (tx) => {
    const invitation = await findInvitationByToken(tx, input.token);

    if (!invitation) {
      throw new InvitationError("Invitation not found.", 404);
    }

    if (normalizeInvitationEmail(invitation.email) !== normalizedEmail) {
      throw new InvitationError(
        "This invitation does not match the signed-in account.",
        403
      );
    }

    if (invitation.status === INVITATION_STATUS_ACCEPTED) {
      const existingMembership = await tx.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: invitation.organizationId,
          },
        },
        select: invitationMembershipSelect,
      });

      if (existingMembership) {
        const existingActiveOrganizationId =
          input.activeOrganizationId?.trim() || invitation.organizationId;

        return {
          invitation,
          membership: existingMembership,
          activeOrganizationId: existingActiveOrganizationId,
        };
      }
    }

    const invitationError = getInvitationReadError(invitation);

    if (invitationError) {
      throw invitationError;
    }

    const membership = await tx.organizationMembership.upsert({
      where: {
        userId_organizationId: {
          userId: input.userId,
          organizationId: invitation.organizationId,
        },
      },
      update: {
        status: ACTIVE_MEMBERSHIP_STATUS,
      },
      create: {
        userId: input.userId,
        organizationId: invitation.organizationId,
        role: invitation.role,
        status: ACTIVE_MEMBERSHIP_STATUS,
      },
      select: invitationMembershipSelect,
    });

    const acceptedInvitationUpdate = await tx.invitation.updateMany({
      where: {
        id: invitation.id,
        status: INVITATION_STATUS_PENDING,
      },
      data: {
        status: INVITATION_STATUS_ACCEPTED,
      },
    });

    if (!acceptedInvitationUpdate.count) {
      const latestInvitation = await tx.invitation.findUnique({
        where: {
          id: invitation.id,
        },
        select: organizationInvitationSelect,
      });

      if (!latestInvitation) {
        throw new InvitationError("Invitation not found.", 404);
      }

      const latestInvitationError = getInvitationReadError(latestInvitation);

      if (latestInvitationError) {
        throw latestInvitationError;
      }

      throw new InvitationError("Invitation could not be accepted.", 409);
    }

    let activeOrganizationId = input.activeOrganizationId?.trim() || "";

    if (!activeOrganizationId) {
      await tx.user.update({
        where: {
          id: input.userId,
        },
        data: {
          activeOrganizationId: invitation.organizationId,
        },
      });

      activeOrganizationId = invitation.organizationId;
    }

    const acceptedInvitation = await tx.invitation.findUnique({
      where: {
        id: invitation.id,
      },
      select: organizationInvitationSelect,
    });

    if (!acceptedInvitation) {
      throw new InvitationError("Invitation not found.", 404);
    }

    trackedInvitationId = acceptedInvitation.id;
    trackedInvitationRole = acceptedInvitation.role;
    trackedOrganizationId = acceptedInvitation.organizationId;

    return {
      invitation: acceptedInvitation,
      membership,
      activeOrganizationId,
    };
  });

  if (trackedInvitationId && trackedInvitationRole && trackedOrganizationId) {
    await trackEvent({
      event: analyticsEventNames.INVITATION_ACCEPTED,
      organizationId: trackedOrganizationId,
      userId: input.userId,
      properties: {
        invitationId: trackedInvitationId,
        invitationRole: trackedInvitationRole,
        acceptanceSource: input.source ?? "authenticated_user",
      },
    });
  }

  return result;
}
