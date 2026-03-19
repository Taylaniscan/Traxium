import { ApprovalStatus, Phase, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  phaseChangeRequestApproval: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  WorkflowError,
  approvePhaseChangeRequest,
  createPhaseChangeRequest,
  getPendingApprovals,
} from "@/lib/data";

function createWorkflowTransactionMock() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "locked-row" }]),
    savingCard: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: "card-1", phase: Phase.VALIDATED }),
    },
    phaseChangeRequest: {
      create: vi.fn().mockResolvedValue({ id: "request-1" }),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: "request-1" }),
    },
    phaseChangeRequestApproval: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(0),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    notification: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({ id: "notification-1" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
    phaseHistory: {
      create: vi.fn().mockResolvedValue({ id: "history-1" }),
    },
  };
}

describe("lib/data workflow flows", () => {
  let tx: ReturnType<typeof createWorkflowTransactionMock>;

  beforeEach(() => {
    tx = createWorkflowTransactionMock();
    mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function") {
        throw new Error("Expected a transaction callback.");
      }

      const transactionCallback = callback as (client: typeof tx) => Promise<unknown>;
      return transactionCallback(tx);
    });
  });

  it("creates a phase change request with organization-scoped approvers", async () => {
    tx.savingCard.findFirst.mockResolvedValue({
      id: "card-1",
      organizationId: "org-1",
      title: "Resin renegotiation",
      phase: Phase.IDEA,
      phaseChangeRequests: [],
    });
    tx.user.findMany.mockResolvedValue([
      {
        id: "approver-1",
        name: "Global Category Leader",
        role: Role.GLOBAL_CATEGORY_LEADER,
      },
    ]);
    tx.phaseChangeRequest.findUnique.mockResolvedValue({
      id: "request-1",
      savingCardId: "card-1",
      currentPhase: Phase.IDEA,
      requestedPhase: Phase.VALIDATED,
      approvalStatus: ApprovalStatus.PENDING,
      requestedById: "requester-1",
      savingCard: {
        id: "card-1",
        organizationId: "org-1",
        title: "Resin renegotiation",
      },
      requestedBy: {
        id: "requester-1",
        name: "Requester",
      },
      approvals: [
        {
          id: "approval-1",
          approverId: "approver-1",
          role: Role.GLOBAL_CATEGORY_LEADER,
          status: ApprovalStatus.PENDING,
          approver: {
            id: "approver-1",
            name: "Global Category Leader",
          },
        },
      ],
    });

    const result = await createPhaseChangeRequest(
      "card-1",
      Phase.VALIDATED,
      "requester-1",
      "org-1",
      "Need category leader approval"
    );

    expect(tx.user.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        role: { in: [Role.GLOBAL_CATEGORY_LEADER] },
      },
      orderBy: { name: "asc" },
    });
    expect(tx.phaseChangeRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          savingCardId: "card-1",
          requestedById: "requester-1",
          requestedPhase: Phase.VALIDATED,
          approvalStatus: ApprovalStatus.PENDING,
          approvals: {
            create: [
              {
                approverId: "approver-1",
                role: Role.GLOBAL_CATEGORY_LEADER,
              },
            ],
          },
        }),
      })
    );
    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        id: "request-1",
        approvalStatus: ApprovalStatus.PENDING,
        requestedPhase: Phase.VALIDATED,
      })
    );
  });

  it("prevents duplicate pending phase change requests for the same saving card", async () => {
    tx.savingCard.findFirst.mockResolvedValue({
      id: "card-1",
      organizationId: "org-1",
      title: "Resin renegotiation",
      phase: Phase.IDEA,
      phaseChangeRequests: [{ id: "request-existing", approvals: [] }],
    });

    await expect(
      createPhaseChangeRequest("card-1", Phase.VALIDATED, "requester-1", "org-1", "Retry request")
    ).rejects.toMatchObject({
      name: "WorkflowError",
      status: 409,
    } satisfies Partial<WorkflowError>);

    expect(tx.phaseChangeRequest.create).not.toHaveBeenCalled();
  });

  it("finalizes a phase change after the last approval and records completion audit entries", async () => {
    const pendingRequest = {
      id: "request-1",
      savingCardId: "card-1",
      currentPhase: Phase.IDEA,
      requestedPhase: Phase.VALIDATED,
      approvalStatus: ApprovalStatus.PENDING,
      requestedById: "requester-1",
      savingCard: {
        id: "card-1",
        organizationId: "org-1",
        title: "Resin renegotiation",
        cancellationReason: null,
      },
      approvals: [
        {
          id: "approval-1",
          approverId: "approver-1",
          role: Role.GLOBAL_CATEGORY_LEADER,
          status: ApprovalStatus.PENDING,
          approver: {
            id: "approver-1",
            name: "Global Category Leader",
          },
        },
      ],
    };

    tx.phaseChangeRequest.findUnique
      .mockResolvedValueOnce(pendingRequest)
      .mockResolvedValueOnce(pendingRequest)
      .mockResolvedValueOnce({
        ...pendingRequest,
        approvalStatus: ApprovalStatus.APPROVED,
        approvals: [
          {
            ...pendingRequest.approvals[0],
            status: ApprovalStatus.APPROVED,
          },
        ],
      });

    const result = await approvePhaseChangeRequest("request-1", "approver-1", "org-1", true, "Looks good");

    expect(tx.phaseChangeRequestApproval.updateMany).toHaveBeenCalledWith({
      where: {
        id: "approval-1",
        status: ApprovalStatus.PENDING,
      },
      data: expect.objectContaining({
        status: ApprovalStatus.APPROVED,
        comment: "Looks good",
        decidedAt: expect.any(Date),
      }),
    });
    expect(tx.phaseChangeRequest.update).toHaveBeenCalledWith({
      where: { id: "request-1" },
      data: { approvalStatus: ApprovalStatus.APPROVED },
    });
    expect(tx.savingCard.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: {
        phase: Phase.VALIDATED,
        cancellationReason: null,
      },
    });

    const auditActions = tx.auditLog.create.mock.calls.map(([call]) => call.data.action);
    expect(auditActions).toContain("phase_change.approved");
    expect(auditActions).toContain("phase_change.completed");
    expect(result).toEqual(expect.objectContaining({ approvalStatus: ApprovalStatus.APPROVED }));
  });

  it("rejects double-processing when the assigned approver already acted on the request", async () => {
    tx.phaseChangeRequest.findUnique.mockResolvedValue({
      id: "request-1",
      savingCardId: "card-1",
      currentPhase: Phase.IDEA,
      requestedPhase: Phase.VALIDATED,
      approvalStatus: ApprovalStatus.PENDING,
      requestedById: "requester-1",
      savingCard: {
        id: "card-1",
        organizationId: "org-1",
        title: "Resin renegotiation",
        cancellationReason: null,
      },
      approvals: [
        {
          id: "approval-1",
          approverId: "approver-1",
          role: Role.GLOBAL_CATEGORY_LEADER,
          status: ApprovalStatus.PENDING,
          approver: {
            id: "approver-1",
            name: "Global Category Leader",
          },
        },
      ],
    });
    tx.phaseChangeRequestApproval.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      approvePhaseChangeRequest("request-1", "approver-1", "org-1", true, "Retry approval")
    ).rejects.toMatchObject({
      name: "WorkflowError",
      status: 409,
      message: "You already processed this request.",
    } satisfies Partial<WorkflowError>);

    expect(tx.phaseChangeRequest.update).not.toHaveBeenCalled();
    expect(tx.savingCard.update).not.toHaveBeenCalled();
  });

  it("retrieves only pending approvals for the current approver and organization", async () => {
    const approvals = [{ id: "approval-1" }];
    mockPrisma.phaseChangeRequestApproval.findMany.mockResolvedValue(approvals);

    const result = await getPendingApprovals("approver-1", "org-1");

    expect(mockPrisma.phaseChangeRequestApproval.findMany).toHaveBeenCalledWith({
      where: {
        approverId: "approver-1",
        status: ApprovalStatus.PENDING,
        phaseChangeRequest: {
          approvalStatus: ApprovalStatus.PENDING,
          savingCard: {
            organizationId: "org-1",
          },
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
    expect(result).toEqual(approvals);
  });
});
