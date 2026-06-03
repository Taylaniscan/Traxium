import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  OTHER_ORGANIZATION_ID,
} from "../helpers/security-fixtures";

const mockPrisma = vi.hoisted(() => ({
  auditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  auditEventTypes,
  listAuditEventsForOrganization,
  writeAuditEvent,
} from "@/lib/audit";

describe("audit event helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes organization-scoped audit events with sanitized payloads", async () => {
    await writeAuditEvent(mockPrisma as never, {
      organizationId: DEFAULT_ORGANIZATION_ID,
      actorUserId: "admin-user-1",
      targetUserId: "user-2",
      targetEntityId: "invite-1",
      eventType: auditEventTypes.INVITE_CREATED,
      detail: "Created a Member invitation.",
      payload: {
        invitationRole: "MEMBER",
        token: "token-123",
        password: "super-secret-password",
        nested: {
          secret: "top-secret",
        },
      },
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        userId: "admin-user-1",
        actorUserId: "admin-user-1",
        targetUserId: "user-2",
        targetEntityId: "invite-1",
        eventType: "invite.created",
        action: "invite.created",
        detail: "Created a Member invitation.",
        payload: {
          invitationRole: "MEMBER",
          token: "[REDACTED]",
          password: "[REDACTED]",
          nested: {
            secret: "[REDACTED]",
          },
        },
      },
    });
  });

  it("lists only supported admin/security audit events for the requested organization", async () => {
    mockPrisma.auditLog.findMany.mockResolvedValueOnce([
      {
        id: "audit-1",
        organizationId: DEFAULT_ORGANIZATION_ID,
        userId: "admin-user-1",
        actorUserId: null,
        targetUserId: "user-2",
        targetEntityId: "membership-2",
        eventType: null,
        action: "membership.role_updated",
        detail: "Changed Jamie Buyer from Member to Admin.",
        payload: {
          membershipId: "membership-2",
          previousRole: "MEMBER",
          nextRole: "ADMIN",
        },
        createdAt: new Date("2026-03-26T12:30:00.000Z"),
        user: {
          id: "admin-user-1",
          name: "Admin User",
          email: "admin@example.com",
        },
      },
    ]);

    const events = await listAuditEventsForOrganization(DEFAULT_ORGANIZATION_ID);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        OR: [
          {
            eventType: {
              in: [
                "member.role_changed",
                "member.removed",
                "invite.created",
                "invite.revoked",
                "invite.resent",
                "workspace.updated",
                "onboarding.workspace_created",
                "phase_change.requested",
                "phase_change.approved",
                "phase_change.rejected",
                "phase_change.completed",
              ],
            },
          },
          {
            action: {
              in: [
                "member.role_changed",
                "member.removed",
                "invite.created",
                "invite.revoked",
                "invite.resent",
                "workspace.updated",
                "onboarding.workspace_created",
                "phase_change.requested",
                "phase_change.approved",
                "phase_change.rejected",
                "phase_change.completed",
                "membership.role_updated",
                "membership.removed",
                "invitation.created",
                "invitation.revoked",
                "invitation.resent",
                "workspace.settings_updated",
              ],
            },
          },
        ],
      },
      select: expect.any(Object),
      orderBy: [{ createdAt: "desc" }],
      take: 20,
    });
    expect(events).toEqual([
      {
        id: "audit-1",
        organizationId: DEFAULT_ORGANIZATION_ID,
        eventType: "member.role_changed",
        action: "member.role_changed",
        detail: "Changed Jamie Buyer from Member to Admin.",
        createdAt: new Date("2026-03-26T12:30:00.000Z"),
        actorUserId: "admin-user-1",
        targetUserId: "user-2",
        targetEntityId: "membership-2",
        payload: {
          membershipId: "membership-2",
          previousRole: "MEMBER",
          nextRole: "ADMIN",
        },
        actor: {
          id: "admin-user-1",
          name: "Admin User",
          email: "admin@example.com",
        },
      },
    ]);
  });

  it("keeps audit listing tenant-scoped to the requested organization id", async () => {
    mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);

    await listAuditEventsForOrganization(OTHER_ORGANIZATION_ID, 10);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: OTHER_ORGANIZATION_ID,
        }),
        take: 10,
      })
    );
  });

  it("surfaces organization-scoped workflow decision events in the activity feed", async () => {
    mockPrisma.auditLog.findMany.mockResolvedValueOnce([
      {
        id: "audit-workflow-1",
        organizationId: DEFAULT_ORGANIZATION_ID,
        userId: "approver-1",
        actorUserId: "approver-1",
        targetUserId: null,
        targetEntityId: "request-1",
        eventType: "phase_change.completed",
        action: "phase_change.completed",
        detail: "Phase changed from IDEA to VALIDATED",
        payload: null,
        createdAt: new Date("2026-04-13T12:30:00.000Z"),
        user: {
          id: "approver-1",
          name: "Finance Approver",
          email: "finance@example.com",
        },
      },
    ]);

    const events = await listAuditEventsForOrganization(DEFAULT_ORGANIZATION_ID);

    expect(events).toEqual([
      expect.objectContaining({
        id: "audit-workflow-1",
        organizationId: DEFAULT_ORGANIZATION_ID,
        eventType: "phase_change.completed",
        action: "phase_change.completed",
        actorUserId: "approver-1",
        targetEntityId: "request-1",
        actor: {
          id: "approver-1",
          name: "Finance Approver",
          email: "finance@example.com",
        },
      }),
    ]);
  });
});
