import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvitationStatus, MembershipStatus, OrganizationRole } from "@prisma/client";

const useRouterMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import AdminSettingsLoadingPage from "@/app/(app)/admin/settings/loading";
import { AdminActivityList } from "@/components/admin/admin-activity-list";
import { InvitationActions } from "@/components/admin/invitation-actions";
import { MemberRoleSelect } from "@/components/admin/member-role-select";
import { MembersManagementPanel } from "@/components/admin/members-management";

describe("admin UI surfaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRouterMock.mockReturnValue({
      refresh: vi.fn(),
    });
  });

  it("renders empty states for members and pending invites", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MembersManagementPanel, {
        members: [],
        pendingInvites: [],
        viewerMembershipId: "membership-1",
        viewerMembershipRole: OrganizationRole.ADMIN,
      })
    );

    expect(markup).toContain("No members in this organization yet");
    expect(markup).toContain("No pending invitations");
    expect(markup).toContain("Pending Invites");
  });

  it("shows disabled state and guidance when a user tries to edit their own role", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberRoleSelect, {
        membershipId: "membership-1",
        memberName: "Admin User",
        currentRole: OrganizationRole.ADMIN,
        viewerMembershipId: "membership-1",
        viewerMembershipRole: OrganizationRole.ADMIN,
      })
    );

    expect(markup).toContain("Your own role must be changed by another workspace admin or owner.");
    expect(markup).toContain("disabled=\"\"");
    expect(markup).toContain("Update");
  });

  it("disables invite cancellation for non-pending invites", () => {
    const markup = renderToStaticMarkup(
      React.createElement(InvitationActions, {
        invitationId: "invite-1",
        inviteeEmail: "accepted.user@example.com",
        inviteStatus: InvitationStatus.ACCEPTED,
      })
    );

    expect(markup).toContain("Resend");
    expect(markup).toContain("Cancel");
    expect(markup).toContain("disabled=\"\"");
  });

  it("renders a useful empty state for admin activity", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminActivityList, {
        events: [],
      })
    );

    expect(markup).toContain("No admin activity yet");
    expect(markup).toContain("Workspace settings updates, membership changes, and invitation lifecycle events will appear here");
  });

  it("renders a loading state for the settings page", () => {
    const markup = renderToStaticMarkup(React.createElement(AdminSettingsLoadingPage));

    expect(markup).toContain("Workspace Settings");
    expect(markup).toContain("Workspace Identity");
    expect(markup).toContain("Recent Admin Activity");
  });

  it("renders populated member and invite rows without styling regressions", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MembersManagementPanel, {
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
            inviteStatus: InvitationStatus.PENDING,
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
        viewerMembershipId: "membership-admin",
        viewerMembershipRole: OrganizationRole.ADMIN,
      })
    );

    expect(markup).toContain("Jamie Buyer");
    expect(markup).toContain("new.member@example.com");
    expect(markup).toContain("Workspace Members");
    expect(markup).toContain("Pending Invitations");
  });
});
