import crypto from "node:crypto";
import type {
  InvitationStatus,
  MembershipStatus,
  OrganizationRole,
  Prisma,
} from "@prisma/client";

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

export async function createOrganizationInvitation(
  actor: AuthenticatedUser,
  input: {
    email: string;
    role: OrganizationRole;
  }
): Promise<OrganizationInvitationRecord> {
  const email = normalizeInvitationEmail(input.email);
  assertInvitationManagementAccess(actor, input.role);

  return prisma.$transaction(async (tx) => {
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
}

export async function getInvitationByToken(
  token: string
): Promise<OrganizationInvitationRecord | null> {
  return findInvitationByToken(prisma, token);
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
}): Promise<InvitationAcceptanceResult> {
  const normalizedEmail = normalizeInvitationEmail(input.userEmail);

  return prisma.$transaction(async (tx) => {
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

    return {
      invitation: acceptedInvitation,
      membership,
      activeOrganizationId,
    };
  });
}
