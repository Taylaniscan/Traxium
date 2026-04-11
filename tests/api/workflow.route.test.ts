import { Phase, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MockAuthGuardError,
  createAuthGuardJsonResponse,
} from "../helpers/security-fixtures";

const requireUserMock = vi.hoisted(() => vi.fn());
const createAuthGuardErrorResponseMock = vi.hoisted(() => vi.fn());
const createPhaseChangeRequestMock = vi.hoisted(() => vi.fn());
const approvePhaseChangeRequestMock = vi.hoisted(() => vi.fn());
const WorkflowErrorMock = vi.hoisted(
  () =>
    class WorkflowError extends Error {
      status: number;

      constructor(message: string, status = 400) {
        super(message);
        this.name = "WorkflowError";
        this.status = status;
      }
    }
);

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
  createAuthGuardErrorResponse: createAuthGuardErrorResponseMock,
}));

vi.mock("@/lib/data", () => ({
  createPhaseChangeRequest: createPhaseChangeRequestMock,
  approvePhaseChangeRequest: approvePhaseChangeRequestMock,
  WorkflowError: WorkflowErrorMock,
}));

import { POST as postApprovePhaseChangeRoute } from "@/app/api/approve-phase-change/route";
import { POST as postPhaseChangeRequestRoute } from "@/app/api/phase-change-request/route";

function createJsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("workflow API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "user-1",
      name: "Workflow User",
      email: "user@example.com",
      role: Role.GLOBAL_CATEGORY_LEADER,
      organizationId: "org-1",
    });
    createAuthGuardErrorResponseMock.mockImplementation(createAuthGuardJsonResponse);
  });

  describe("app/api/phase-change-request/route.ts", () => {
    it("returns 401 JSON for unauthenticated requests", async () => {
      requireUserMock.mockRejectedValueOnce(
        new MockAuthGuardError(
          "Authenticated session is required.",
          401,
          "UNAUTHENTICATED"
        )
      );

      const response = await postPhaseChangeRequestRoute(
        createJsonRequest("http://localhost/api/phase-change-request", {
          savingCardId: "card-1",
          requestedPhase: Phase.VALIDATED,
        })
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
      expect(createPhaseChangeRequestMock).not.toHaveBeenCalled();
    });

    it("returns 422 for malformed phase change payloads", async () => {
      const response = await postPhaseChangeRequestRoute(
        createJsonRequest("http://localhost/api/phase-change-request", {
          savingCardId: "",
          requestedPhase: "NOT_A_PHASE",
        })
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
      expect(createPhaseChangeRequestMock).not.toHaveBeenCalled();
    });

    it("preserves workflow conflict status mappings", async () => {
      createPhaseChangeRequestMock.mockRejectedValueOnce(
        new WorkflowErrorMock("There is already a pending phase change request for this saving card.", 409)
      );

      const response = await postPhaseChangeRequestRoute(
        createJsonRequest("http://localhost/api/phase-change-request", {
          savingCardId: "card-1",
          requestedPhase: Phase.VALIDATED,
          comment: "Promote to validated",
        })
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: "There is already a pending phase change request for this saving card.",
      });
    });

    it("returns 422 when cancellation is requested without a reason", async () => {
      const response = await postPhaseChangeRequestRoute(
        createJsonRequest("http://localhost/api/phase-change-request", {
          savingCardId: "card-1",
          requestedPhase: Phase.CANCELLED,
        })
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        error: "Cancellation reason is required.",
      });
      expect(createPhaseChangeRequestMock).not.toHaveBeenCalled();
    });

    it("preserves skipped-transition workflow conflicts", async () => {
      createPhaseChangeRequestMock.mockRejectedValueOnce(
        new WorkflowErrorMock(
          "Cannot move a saving card directly from IDEA to ACHIEVED.",
          409
        )
      );

      const response = await postPhaseChangeRequestRoute(
        createJsonRequest("http://localhost/api/phase-change-request", {
          savingCardId: "card-1",
          requestedPhase: Phase.ACHIEVED,
          comment: "Skip ahead",
        })
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: "Cannot move a saving card directly from IDEA to ACHIEVED.",
      });
    });

    it("returns 201 with the created phase change request on success", async () => {
      createPhaseChangeRequestMock.mockResolvedValueOnce({
        id: "request-1",
        requestedPhase: Phase.VALIDATED,
        approvalStatus: "PENDING",
      });

      const response = await postPhaseChangeRequestRoute(
        createJsonRequest("http://localhost/api/phase-change-request", {
          savingCardId: "card-1",
          requestedPhase: Phase.VALIDATED,
          comment: "Promote to validated",
        })
      );

      expect(createPhaseChangeRequestMock).toHaveBeenCalledWith(
        "card-1",
        Phase.VALIDATED,
        "user-1",
        "org-1",
        "Promote to validated",
        undefined
      );
      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toEqual({
        id: "request-1",
        requestedPhase: Phase.VALIDATED,
        approvalStatus: "PENDING",
      });
    });

    it("passes cancellation reasons through on valid cancellation requests", async () => {
      createPhaseChangeRequestMock.mockResolvedValueOnce({
        id: "request-2",
        requestedPhase: Phase.CANCELLED,
        approvalStatus: "PENDING",
      });

      const response = await postPhaseChangeRequestRoute(
        createJsonRequest("http://localhost/api/phase-change-request", {
          savingCardId: "card-1",
          requestedPhase: Phase.CANCELLED,
          comment: "Stop the initiative",
          cancellationReason: "Supplier withdrew",
        })
      );

      expect(createPhaseChangeRequestMock).toHaveBeenCalledWith(
        "card-1",
        Phase.CANCELLED,
        "user-1",
        "org-1",
        "Stop the initiative",
        "Supplier withdrew"
      );
      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toEqual({
        id: "request-2",
        requestedPhase: Phase.CANCELLED,
        approvalStatus: "PENDING",
      });
    });
  });

  describe("app/api/approve-phase-change/route.ts", () => {
    it("returns 401 JSON for unauthenticated requests", async () => {
      requireUserMock.mockRejectedValueOnce(
        new MockAuthGuardError(
          "Authenticated session is required.",
          401,
          "UNAUTHENTICATED"
        )
      );

      const response = await postApprovePhaseChangeRoute(
        createJsonRequest("http://localhost/api/approve-phase-change", {
          requestId: "request-1",
          approved: true,
        })
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
      expect(approvePhaseChangeRequestMock).not.toHaveBeenCalled();
    });

    it("returns 422 for malformed approval payloads", async () => {
      const response = await postApprovePhaseChangeRoute(
        createJsonRequest("http://localhost/api/approve-phase-change", {
          requestId: "",
          approved: "yes",
        })
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
      expect(approvePhaseChangeRequestMock).not.toHaveBeenCalled();
    });

    it("preserves workflow service error status mappings", async () => {
      approvePhaseChangeRequestMock.mockRejectedValueOnce(
        new WorkflowErrorMock("You are not assigned to approve this request.", 403)
      );

      const response = await postApprovePhaseChangeRoute(
        createJsonRequest("http://localhost/api/approve-phase-change", {
          requestId: "request-1",
          approved: true,
          comment: "Approving",
        })
      );

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: "You are not assigned to approve this request.",
      });
    });

    it("returns the approval result on success", async () => {
      approvePhaseChangeRequestMock.mockResolvedValueOnce({
        id: "request-1",
        approvalStatus: "APPROVED",
        requestedPhase: Phase.VALIDATED,
      });

      const response = await postApprovePhaseChangeRoute(
        createJsonRequest("http://localhost/api/approve-phase-change", {
          requestId: "request-1",
          approved: true,
          comment: "Approving",
        })
      );

      expect(approvePhaseChangeRequestMock).toHaveBeenCalledWith(
        "request-1",
        "user-1",
        "org-1",
        true,
        "Approving"
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        id: "request-1",
        approvalStatus: "APPROVED",
        requestedPhase: Phase.VALIDATED,
      });
    });
  });
});
