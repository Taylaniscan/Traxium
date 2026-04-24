import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipStatus, OrganizationRole, Role } from "@prisma/client";

import {
  DEFAULT_ORGANIZATION_ID,
  createSessionUser,
} from "../helpers/security-fixtures";

const requireUserMock = vi.hoisted(() => vi.fn());
const canManageOrganizationMembersMock = vi.hoisted(() => vi.fn());
const changePasswordFormMock = vi.hoisted(() =>
  vi.fn(() => React.createElement("div", null, "change-password-form"))
);

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/organizations", () => ({
  canManageOrganizationMembers: canManageOrganizationMembersMock,
}));

vi.mock("@/components/profile/change-password-form", () => ({
  ChangePasswordForm: changePasswordFormMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import ProfilePage from "@/app/(app)/profile/page";

describe("profile page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue(
      createSessionUser({
        role: Role.GLOBAL_CATEGORY_LEADER,
        activeOrganization: {
          membershipId: "membership-admin",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
    canManageOrganizationMembersMock.mockReturnValue(true);
  });

  it("renders the security section with the password-change form", async () => {
    const page = await ProfilePage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Profile Information");
    expect(markup).toContain("Procurement Specialist");
    expect(markup).toContain("Security");
    expect(markup).toContain("change-password-form");
    expect(markup).toContain("Workspace Settings");
  });
});
