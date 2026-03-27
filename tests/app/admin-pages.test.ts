import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipStatus, OrganizationRole, Role } from "@prisma/client";

import {
  DEFAULT_ORGANIZATION_ID,
  createSessionUser,
} from "../helpers/security-fixtures";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  })
);
const requireOrganizationMock = vi.hoisted(() => vi.fn());
const canManageOrganizationMembersMock = vi.hoisted(() => vi.fn());
const getOrganizationMembersDirectoryMock = vi.hoisted(() => vi.fn());
const getOrganizationSettingsMock = vi.hoisted(() => vi.fn());
const getOrganizationAdminAuditEventsMock = vi.hoisted(() => vi.fn());
const membersManagementPanelMock = vi.hoisted(() =>
  vi.fn(({ members, pendingInvites }: { members: unknown[]; pendingInvites: unknown[] }) =>
    React.createElement(
      "div",
      {
        "data-members-count": String(members.length),
        "data-pending-count": String(pendingInvites.length),
      },
      "members-panel"
    )
  )
);
const workspaceSettingsFormMock = vi.hoisted(() =>
  vi.fn(({ organization }: { organization: { name: string } }) =>
    React.createElement("div", { "data-organization-name": organization.name }, "settings-form")
  )
);
const adminActivityListMock = vi.hoisted(() =>
  vi.fn(({ events }: { events: unknown[] }) =>
    React.createElement("div", { "data-audit-count": String(events.length) }, "audit-list")
  )
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOrganization: requireOrganizationMock,
}));

vi.mock("@/lib/organizations", () => ({
  canManageOrganizationMembers: canManageOrganizationMembersMock,
  getOrganizationMembersDirectory: getOrganizationMembersDirectoryMock,
  getOrganizationSettings: getOrganizationSettingsMock,
  getOrganizationAdminAuditEvents: getOrganizationAdminAuditEventsMock,
}));

vi.mock("@/components/admin/members-management", () => ({
  MembersManagementPanel: membersManagementPanelMock,
}));

vi.mock("@/components/admin/workspace-settings-form", () => ({
  WorkspaceSettingsForm: workspaceSettingsFormMock,
}));

vi.mock("@/components/admin/admin-activity-list", () => ({
  AdminActivityList: adminActivityListMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import AdminMembersPage from "@/app/(app)/admin/members/page";
import AdminSettingsPage from "@/app/(app)/admin/settings/page";

describe("admin pages", () => {
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
    canManageOrganizationMembersMock.mockReturnValue(true);
    getOrganizationMembersDirectoryMock.mockResolvedValue({
      members: [
        {
          id: "membership-2",
          userId: "user-2",
          name: "Jamie Buyer",
          email: "jamie@example.com",
          role: OrganizationRole.MEMBER,
          membershipStatus: MembershipStatus.ACTIVE,
          joinedAt: new Date("2026-03-20T09:00:00.000Z"),
          createdAt: new Date("2026-03-18T09:00:00.000Z"),
          updatedAt: new Date("2026-03-21T09:00:00.000Z"),
        },
      ],
      pendingInvites: [
        {
          id: "invite-1",
          email: "new.member@example.com",
          role: OrganizationRole.MEMBER,
          inviteStatus: "PENDING",
          invitedAt: new Date("2026-03-26T12:00:00.000Z"),
          expiresAt: new Date("2026-04-02T12:00:00.000Z"),
          updatedAt: new Date("2026-03-26T12:00:00.000Z"),
          invitedBy: {
            id: "admin-user-1",
            name: "Admin User",
            email: "admin@example.com",
          },
        },
      ],
    });
    getOrganizationSettingsMock.mockResolvedValue({
      id: DEFAULT_ORGANIZATION_ID,
      name: "Atlas Procurement",
      description: "Global procurement savings governance workspace.",
      slug: "atlas-procurement",
      createdAt: new Date("2026-03-20T09:00:00.000Z"),
      updatedAt: new Date("2026-03-26T12:00:00.000Z"),
    });
    getOrganizationAdminAuditEventsMock.mockResolvedValue([
      {
        id: "audit-1",
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

  it("renders the admin members page with active-organization data", async () => {
    const page = await AdminMembersPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(getOrganizationMembersDirectoryMock).toHaveBeenCalledWith(DEFAULT_ORGANIZATION_ID);
    expect(membersManagementPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        members: expect.arrayContaining([
          expect.objectContaining({
            email: "jamie@example.com",
          }),
        ]),
        pendingInvites: expect.arrayContaining([
          expect.objectContaining({
            email: "new.member@example.com",
          }),
        ]),
        viewerMembershipId: "membership-admin",
        viewerMembershipRole: OrganizationRole.ADMIN,
      }),
      undefined
    );
    expect(markup).toContain("Members");
    expect(markup).toContain("members-panel");
    expect(markup).toContain("data-members-count=\"1\"");
    expect(markup).toContain("data-pending-count=\"1\"");
  });

  it("redirects non-admin users away from the members page", async () => {
    canManageOrganizationMembersMock.mockReturnValueOnce(false);

    await expect(AdminMembersPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    expect(getOrganizationMembersDirectoryMock).not.toHaveBeenCalled();
  });

  it("renders the admin settings page with settings and audit data", async () => {
    const page = await AdminSettingsPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(getOrganizationSettingsMock).toHaveBeenCalledWith(DEFAULT_ORGANIZATION_ID);
    expect(getOrganizationAdminAuditEventsMock).toHaveBeenCalledWith(DEFAULT_ORGANIZATION_ID);
    expect(workspaceSettingsFormMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: expect.objectContaining({
          name: "Atlas Procurement",
        }),
      }),
      undefined
    );
    expect(adminActivityListMock).toHaveBeenCalledWith(
      expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({
            action: "member.role_changed",
          }),
        ]),
      }),
      undefined
    );
    expect(markup).toContain("Workspace Settings");
    expect(markup).toContain("settings-form");
    expect(markup).toContain("audit-list");
  });

  it("redirects non-admin users away from the settings page", async () => {
    canManageOrganizationMembersMock.mockReturnValueOnce(false);

    await expect(AdminSettingsPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    expect(getOrganizationSettingsMock).not.toHaveBeenCalled();
    expect(getOrganizationAdminAuditEventsMock).not.toHaveBeenCalled();
  });
});
