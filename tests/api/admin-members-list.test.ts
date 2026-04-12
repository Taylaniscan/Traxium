import {
  InvitationStatus,
  MembershipStatus,
  OrganizationRole,
  Role,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  MockAuthGuardError,
  OTHER_ORGANIZATION_ID,
  createAuthGuardJsonResponse,
  createSessionUser,
} from "../helpers/security-fixtures";

const requireOrganizationMock = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  organizationMembership: {
    findMany: vi.fn(),
  },
  invitation: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireOrganization: requireOrganizationMock,
  createAuthGuardErrorResponse: createAuthGuardJsonResponse,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/admin/members/route";

function createMembershipRecord(
  overrides: Partial<{
    id: string;
    userId: string;
    organizationId: string;
    role: OrganizationRole;
    status: MembershipStatus;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
      createdAt: Date;
      updatedAt: Date;
    };
  }> = {}
) {
  return {
    id: "membership-1",
    userId: DEFAULT_USER_ID,
    organizationId: DEFAULT_ORGANIZATION_ID,
    role: OrganizationRole.ADMIN,
    status: MembershipStatus.ACTIVE,
    createdAt: new Date("2026-03-20T09:00:00.000Z"),
    updatedAt: new Date("2026-03-21T09:00:00.000Z"),
    user: {
      id: DEFAULT_USER_ID,
      name: "Alex Buyer",
      email: "alex@example.com",
      createdAt: new Date("2026-03-18T09:00:00.000Z"),
      updatedAt: new Date("2026-03-21T09:00:00.000Z"),
    },
    ...overrides,
  };
}

function createPendingInviteRecord(
  overrides: Partial<{
    id: string;
    organizationId: string;
    email: string;
    role: OrganizationRole;
    status: InvitationStatus;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    invitedBy: {
      id: string;
      name: string;
      email: string;
    };
  }> = {}
) {
  return {
    id: "invite-1",
    organizationId: DEFAULT_ORGANIZATION_ID,
    email: "new.member@example.com",
    role: OrganizationRole.MEMBER,
    status: InvitationStatus.PENDING,
    expiresAt: new Date("2026-04-02T12:00:00.000Z"),
    createdAt: new Date("2026-03-26T12:00:00.000Z"),
    updatedAt: new Date("2026-03-26T12:00:00.000Z"),
    invitedBy: {
      id: "admin-user-1",
      name: "Owner User",
      email: "owner@example.com",
    },
    ...overrides,
  };
}

describe("admin members list route", () => {
  const request = new Request("http://localhost/api/admin/members", {
    method: "GET",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    requireOrganizationMock.mockResolvedValue(
      createSessionUser({
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
        activeOrganization: {
          membershipId: "membership-admin",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
    mockPrisma.organizationMembership.findMany.mockResolvedValue([
      createMembershipRecord(),
    ]);
    mockPrisma.invitation.findMany.mockResolvedValue([
      createPendingInviteRecord(),
    ]);
  });

  it("allows an organization admin to view members and pending invites", async () => {
    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      organizationId: DEFAULT_ORGANIZATION_ID,
      members: [
        {
          id: "membership-1",
          userId: DEFAULT_USER_ID,
          name: "Alex Buyer",
          email: "alex@example.com",
          role: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
          joinedAt: "2026-03-20T09:00:00.000Z",
          createdAt: "2026-03-18T09:00:00.000Z",
          updatedAt: "2026-03-21T09:00:00.000Z",
        },
      ],
      pendingInvites: [
        {
          id: "invite-1",
          email: "new.member@example.com",
          role: OrganizationRole.MEMBER,
          inviteStatus: InvitationStatus.PENDING,
          invitedAt: "2026-03-26T12:00:00.000Z",
          expiresAt: "2026-04-02T12:00:00.000Z",
          updatedAt: "2026-03-26T12:00:00.000Z",
          invitedBy: {
            id: "admin-user-1",
            name: "Owner User",
            email: "owner@example.com",
          },
        },
      ],
    });
  });

  it("rejects a normal member", async () => {
    requireOrganizationMock.mockResolvedValueOnce(createSessionUser());

    const response = await GET(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Forbidden.",
    });
    expect(mockPrisma.organizationMembership.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.invitation.findMany).not.toHaveBeenCalled();
  });

  it("scopes queries to the active organization only", async () => {
    requireOrganizationMock.mockResolvedValueOnce(
      createSessionUser({
        organizationId: OTHER_ORGANIZATION_ID,
        activeOrganizationId: OTHER_ORGANIZATION_ID,
        activeOrganization: {
          membershipId: "membership-owner",
          organizationId: OTHER_ORGANIZATION_ID,
          membershipRole: OrganizationRole.OWNER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
    mockPrisma.organizationMembership.findMany.mockResolvedValueOnce([
      createMembershipRecord({
        organizationId: OTHER_ORGANIZATION_ID,
        id: "membership-2",
      }),
    ]);
    mockPrisma.invitation.findMany.mockResolvedValueOnce([]);

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockPrisma.organizationMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: OTHER_ORGANIZATION_ID,
        },
      })
    );
    expect(mockPrisma.invitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: OTHER_ORGANIZATION_ID,
          status: InvitationStatus.PENDING,
        },
      })
    );
  });

  it("returns only pending invites for the active organization", async () => {
    await GET(request);

    expect(mockPrisma.invitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: DEFAULT_ORGANIZATION_ID,
          status: InvitationStatus.PENDING,
        },
      })
    );
  });

  it("uses auth guard responses when no authenticated organization context exists", async () => {
    requireOrganizationMock.mockRejectedValueOnce(
      new MockAuthGuardError("Authenticated session is required.", 401, "UNAUTHENTICATED")
    );

    const response = await GET(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
  });
});
