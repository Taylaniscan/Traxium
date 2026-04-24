import { ApprovalStatus, Phase, Prisma } from "@prisma/client";
import { buildOrganizationUserWhere } from "@/lib/organizations";
import { requiredRolesForPhase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  buildTenantScopeWhere,
  hasTenantOwnership,
  resolveTenantScope,
} from "@/lib/tenant-scope";
import type { TenantContextSource } from "@/lib/types";
import {
  isPhaseTransitionAllowed,
  phaseRequiresCancellationReason,
} from "@/lib/workflow";
import { WorkflowError } from "@/lib/workflow/errors";
import { invalidatePortfolioSurfaceCaches } from "@/lib/workspace/portfolio-surface-cache";

const phaseChangeRequestResultInclude = {
  savingCard: true,
  requestedBy: true,
  approvals: {
    include: {
      approver: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.PhaseChangeRequestInclude;

function buildSavingCardPath(savingCardId: string) {
  return `/saving-cards/${savingCardId}`;
}

export async function addApproval(
  _savingCardId: string,
  _phase: Phase,
  _approverId: string,
  _approved: boolean,
  _comment?: string
) {
  throw new WorkflowError(
    "Direct approval actions are disabled. Use /api/approve-phase-change for assigned workflow requests.",
    409
  );
}

async function lockSavingCardForWorkflow(
  tx: Prisma.TransactionClient,
  savingCardId: string,
  organizationId: string
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "SavingCard"
    WHERE "id" = ${savingCardId}
      AND "organizationId" = ${organizationId}
    FOR UPDATE
  `);

  if (!rows.length) {
    throw new WorkflowError("Saving card not found.", 404);
  }
}

async function lockPhaseChangeRequestForWorkflow(
  tx: Prisma.TransactionClient,
  requestId: string
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "PhaseChangeRequest"
    WHERE "id" = ${requestId}
    FOR UPDATE
  `);

  if (!rows.length) {
    throw new WorkflowError("Phase change request not found.", 404);
  }
}

async function getPhaseChangeRequestWithRelations(
  tx: Prisma.TransactionClient,
  requestId: string
) {
  return tx.phaseChangeRequest.findUnique({
    where: { id: requestId },
    include: phaseChangeRequestResultInclude,
  });
}

export async function createPhaseChangeRequest(
  savingCardId: string,
  requestedPhase: Phase,
  requestedById: string,
  context: TenantContextSource,
  comment?: string,
  cancellationReason?: string
) {
  const { organizationId } = resolveTenantScope(context);

  return prisma.$transaction(async (tx) => {
    await lockSavingCardForWorkflow(tx, savingCardId, organizationId);

    const card = await tx.savingCard.findFirst({
      where: buildTenantScopeWhere(organizationId, {
        id: savingCardId,
      }),
      include: {
        phaseChangeRequests: {
          where: { approvalStatus: ApprovalStatus.PENDING },
          include: { approvals: true },
        },
      },
    });

    if (!card) {
      throw new WorkflowError("Saving card not found.", 404);
    }

    if (card.phase === requestedPhase) {
      throw new WorkflowError("Saving card is already in that phase.");
    }

    if (!isPhaseTransitionAllowed(card.phase, requestedPhase)) {
      throw new WorkflowError(
        `Cannot move a saving card directly from ${card.phase} to ${requestedPhase}.`,
        409
      );
    }

    if (
      phaseRequiresCancellationReason(requestedPhase) &&
      !cancellationReason?.trim()
    ) {
      throw new WorkflowError("Cancellation reason is required.");
    }

    if (card.phaseChangeRequests.length) {
      throw new WorkflowError(
        "There is already a pending phase change request for this saving card.",
        409
      );
    }

    const requiredRoles = requiredRolesForPhase(requestedPhase);

    if (!requiredRoles.length) {
      throw new WorkflowError(
        "No approval rules are configured for the requested phase."
      );
    }

    const approvers = await tx.user.findMany({
      where: buildOrganizationUserWhere(organizationId, {
        role: { in: requiredRoles },
      }),
      orderBy: { name: "asc" },
    });

    if (!approvers.length) {
      throw new WorkflowError("No approvers are configured for the requested phase.");
    }

    const request = await tx.phaseChangeRequest.create({
      data: {
        savingCardId,
        currentPhase: card.phase,
        requestedPhase,
        requestedById,
        comment: comment?.trim() || null,
        cancellationReason: cancellationReason?.trim() || null,
        approvalStatus: ApprovalStatus.PENDING,
        approvals: {
          create: approvers.map((approver) => ({
            approverId: approver.id,
            role: approver.role,
          })),
        },
      },
      include: {
        requestedBy: true,
        approvals: { include: { approver: true } },
      },
    });

    await tx.notification.createMany({
      data: approvers.map((approver) => ({
        organizationId,
        userId: approver.id,
        title: "Phase change requested",
        message: `${card.title} requests movement from ${card.phase} to ${requestedPhase}.`,
        href: "/open-actions",
      })),
    });

    await tx.auditLog.create({
      data: {
        userId: requestedById,
        savingCardId,
        action: "phase_change.requested",
        detail: `Requested phase change from ${card.phase} to ${requestedPhase}`,
      },
    });

    const createdRequest = await getPhaseChangeRequestWithRelations(tx, request.id);

    if (!createdRequest) {
      throw new WorkflowError("Phase change request not found.", 404);
    }

    return createdRequest;
  });
}

export async function approvePhaseChangeRequest(
  requestId: string,
  approverId: string,
  context: TenantContextSource,
  approved: boolean,
  comment?: string
) {
  const { organizationId } = resolveTenantScope(context);

  const result = await prisma.$transaction(async (tx) => {
    await lockPhaseChangeRequestForWorkflow(tx, requestId);

    const request = await getPhaseChangeRequestWithRelations(tx, requestId);

    if (!request) {
      throw new WorkflowError("Phase change request not found.", 404);
    }

    if (!hasTenantOwnership(request.savingCard, organizationId)) {
      throw new WorkflowError("Phase change request not found.", 404);
    }

    if (request.approvalStatus !== ApprovalStatus.PENDING) {
      throw new WorkflowError("This phase change request is already closed.", 409);
    }

    const approval = request.approvals.find((item) => item.approverId === approverId);
    if (!approval) {
      throw new WorkflowError("You are not assigned to approve this request.", 403);
    }

    const approvalUpdate = await tx.phaseChangeRequestApproval.updateMany({
      where: {
        id: approval.id,
        status: ApprovalStatus.PENDING,
      },
      data: {
        status: approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
        comment: comment?.trim() || null,
        decidedAt: new Date(),
      },
    });

    if (!approvalUpdate.count) {
      throw new WorkflowError("You already processed this request.", 409);
    }

    if (!approved) {
      const rejectedRequest = await tx.phaseChangeRequest.update({
        where: { id: requestId },
        data: { approvalStatus: ApprovalStatus.REJECTED },
      });

      await tx.notification.create({
        data: {
          organizationId,
          userId: request.requestedById,
          title: "Phase change rejected",
          message: `${request.savingCard.title} phase change to ${request.requestedPhase} was rejected.`,
          href: buildSavingCardPath(request.savingCardId),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: approverId,
          savingCardId: request.savingCardId,
          action: "phase_change.rejected",
          detail: `Phase change to ${request.requestedPhase} rejected`,
        },
      });

      const rejectedResult = await getPhaseChangeRequestWithRelations(
        tx,
        rejectedRequest.id
      );

      if (!rejectedResult) {
        throw new WorkflowError("Phase change request not found.", 404);
      }

      return rejectedResult;
    }

    const remaining = await tx.phaseChangeRequestApproval.count({
      where: {
        phaseChangeRequestId: requestId,
        status: ApprovalStatus.PENDING,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: approverId,
        savingCardId: request.savingCardId,
        action: "phase_change.approved",
        detail:
          remaining === 0
            ? `Final approval recorded for phase change to ${request.requestedPhase}`
            : `Approval recorded for phase change to ${request.requestedPhase}`,
      },
    });

    if (remaining === 0) {
      await tx.phaseChangeRequest.update({
        where: { id: requestId },
        data: { approvalStatus: ApprovalStatus.APPROVED },
      });

      await finalizePhaseChangeRequest(tx, requestId, approverId);
    }

    const nextResult = await getPhaseChangeRequestWithRelations(tx, requestId);

    if (!nextResult) {
      throw new WorkflowError("Phase change request not found.", 404);
    }

    return nextResult;
  });

  if (result.approvalStatus === ApprovalStatus.APPROVED) {
    invalidatePortfolioSurfaceCaches(organizationId);
  }

  return result;
}

async function finalizePhaseChangeRequest(
  tx: Prisma.TransactionClient,
  requestId: string,
  actorId: string
) {
  const request = await tx.phaseChangeRequest.findUnique({
    where: { id: requestId },
    include: { savingCard: true },
  });

  if (!request) {
    throw new Error("Phase change request not found.");
  }

  await tx.savingCard.update({
    where: { id: request.savingCardId },
    data: {
      phase: request.requestedPhase,
      cancellationReason:
        request.requestedPhase === "CANCELLED"
          ? request.cancellationReason ?? request.savingCard.cancellationReason
          : null,
    },
  });

  await tx.phaseHistory.create({
    data: {
      savingCardId: request.savingCardId,
      fromPhase: request.currentPhase,
      toPhase: request.requestedPhase,
      changedById: actorId,
    },
  });

  await tx.notification.create({
    data: {
      organizationId: request.savingCard.organizationId,
      userId: request.requestedById,
      title: "Phase change approved",
      message: `${request.savingCard.title} moved to ${request.requestedPhase}.`,
      href: buildSavingCardPath(request.savingCardId),
    },
  });

  await tx.auditLog.create({
    data: {
      userId: actorId,
      savingCardId: request.savingCardId,
      action: "phase_change.completed",
      detail: `Phase changed from ${request.currentPhase} to ${request.requestedPhase}`,
    },
  });
}

export async function getPendingApprovals(
  userId: string,
  context?: TenantContextSource
) {
  const organizationId = context ? resolveTenantScope(context).organizationId : null;

  return prisma.phaseChangeRequestApproval.findMany({
    where: {
      approverId: userId,
      status: ApprovalStatus.PENDING,
      phaseChangeRequest: {
        approvalStatus: ApprovalStatus.PENDING,
        savingCard: organizationId
          ? buildTenantScopeWhere(organizationId)
          : undefined,
      },
    },
    include: {
      phaseChangeRequest: {
        include: {
          savingCard: true,
          requestedBy: true,
          approvals: { include: { approver: true } },
        },
      },
      approver: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPendingPhaseChangeRequests(
  context: TenantContextSource
) {
  const organizationId = resolveTenantScope(context).organizationId;

  return prisma.phaseChangeRequest.findMany({
    where: {
      approvalStatus: ApprovalStatus.PENDING,
      savingCard: buildTenantScopeWhere(organizationId),
    },
    include: {
      savingCard: true,
      requestedBy: true,
      approvals: {
        where: {
          status: ApprovalStatus.PENDING,
        },
        include: {
          approver: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getApprovalStatus(cardId: string, phase: Phase) {
  const request = await prisma.phaseChangeRequest.findFirst({
    where: {
      savingCardId: cardId,
      requestedPhase: phase,
    },
    include: {
      approvals: {
        include: {
          approver: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const requiredRoles = requiredRolesForPhase(phase);

  return requiredRoles.map((role) => ({
    role,
    approved: (request?.approvals ?? []).some(
      (approval) =>
        approval.status === ApprovalStatus.APPROVED &&
        approval.approver.role === role
    ),
  }));
}
