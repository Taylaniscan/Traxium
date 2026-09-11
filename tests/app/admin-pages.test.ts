import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipStatus, OrganizationRole, Role } from "@prisma/client";

import {
  DEFAULT_ORGANIZATION_ID,
  createSessionUser,
} from "../helpers/security-fixtures";
import type { OrganizationAccessStateResult } from "@/lib/billing/types";

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
const getOrganizationAccessStateMock = vi.hoisted(() => vi.fn());
const isStripeBillingConfiguredMock = vi.hoisted(() => vi.fn());
const getMissingStripeBillingEnvKeysMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());
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
  vi.fn(
    ({ organization }: {
      organization: { name: string };
    }) =>
      React.createElement(
        "div",
        {
          "data-organization-name": organization.name,
        },
        "settings-form",
        React.createElement("span", null, "Workspace Identity")
      )
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

vi.mock("@/lib/billing/access", () => ({
  getOrganizationAccessState: getOrganizationAccessStateMock,
}));

vi.mock("@/lib/billing/config", () => ({
  getMissingStripeBillingEnvKeys: getMissingStripeBillingEnvKeysMock,
  isStripeBillingConfigured: isStripeBillingConfiguredMock,
}));

vi.mock("@/lib/organizations", () => ({
  canManageOrganizationMembers: canManageOrganizationMembersMock,
  getOrganizationMembersDirectory: getOrganizationMembersDirectoryMock,
  getOrganizationSettings: getOrganizationSettingsMock,
  getOrganizationAdminAuditEvents: getOrganizationAdminAuditEventsMock,
}));

vi.mock("@/lib/observability", () => ({
  captureException: captureExceptionMock,
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

function createAdminBillingState(
  reasonCode: OrganizationAccessStateResult["reasonCode"],
  overrides: Partial<OrganizationAccessStateResult> = {}
): OrganizationAccessStateResult {
  return {
    organizationId: DEFAULT_ORGANIZATION_ID,
    subscriptionId:
      reasonCode === "workspace_trial" || reasonCode === "no_subscription"
        ? null
        : "subrec_1",
    stripeSubscriptionId:
      reasonCode === "workspace_trial" || reasonCode === "no_subscription"
        ? null
        : "sub_1",
    rawSubscriptionStatus: null,
    accessState:
      reasonCode === "active"
        ? "active"
        : reasonCode === "trialing" || reasonCode === "workspace_trial"
          ? "trialing"
          : reasonCode === "trial_expired"
            ? "trial_expired"
            : reasonCode === "past_due_grace_period"
              ? "grace_period"
              : reasonCode === "past_due_blocked"
                ? "blocked_past_due"
                : reasonCode === "unpaid"
                  ? "blocked_unpaid"
                  : reasonCode === "no_subscription"
                    ? "no_subscription"
                    : "blocked_canceled",
    reasonCode,
    isBlocked:
      reasonCode === "no_subscription" ||
      reasonCode === "trial_expired" ||
      reasonCode === "past_due_blocked" ||
      reasonCode === "unpaid" ||
      reasonCode === "canceled",
    currentPeriodEnd:
      reasonCode === "active" || reasonCode === "past_due_grace_period"
        ? new Date("2026-04-20T00:00:00.000Z")
        : null,
    trialEndsAt:
      reasonCode === "workspace_trial" || reasonCode === "trialing"
        ? new Date("2099-01-15T00:00:00.000Z")
        : null,
    trialSource:
      reasonCode === "workspace_trial"
        ? "workspace"
        : reasonCode === "trialing"
          ? "subscription"
          : null,
    plan:
      reasonCode === "workspace_trial" || reasonCode === "no_subscription"
        ? null
        : {
            productPlanId: "plan_1",
            planCode: "growth",
            planName: "Growth",
            stripeProductId: "prod_1",
            planMetadata: null,
            planPriceId: "price_1",
            stripePriceId: "price_growth",
            priceType: "LICENSED",
            billingInterval: "MONTH",
            intervalCount: 1,
            currencyCode: "usd",
            unitAmount: 29900,
            priceMetadata: null,
          },
    ...overrides,
  };
}

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
    getOrganizationAccessStateMock.mockResolvedValue({
      organizationId: DEFAULT_ORGANIZATION_ID,
      subscriptionId: "subrec_1",
      stripeSubscriptionId: "sub_1",
      rawSubscriptionStatus: "ACTIVE",
      accessState: "active",
      reasonCode: "active",
      isBlocked: false,
      currentPeriodEnd: new Date("2026-04-20T00:00:00.000Z"),
      trialEndsAt: null,
      trialSource: null,
      plan: {
        productPlanId: "plan_1",
        planCode: "growth",
        planName: "Growth",
        stripeProductId: "prod_1",
        planMetadata: null,
        planPriceId: "price_1",
        stripePriceId: "price_growth",
        priceType: "LICENSED",
        billingInterval: "MONTH",
        intervalCount: 1,
        currencyCode: "usd",
        unitAmount: 29900,
        priceMetadata: null,
      },
    });
    isStripeBillingConfiguredMock.mockReturnValue(true);
    getMissingStripeBillingEnvKeysMock.mockReturnValue([]);
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

  it("renders all four UtopiaTrax demo members for the Owner", async () => {
    getOrganizationMembersDirectoryMock.mockResolvedValueOnce({
      members: [
        ["Taylan Iscan", "taylaniscan+4@gmail.com", OrganizationRole.OWNER],
        ["Mert Dulger", "taylaniscan+5@gmail.com", OrganizationRole.ADMIN],
        ["Aylin Demir", "taylaniscan+6@gmail.com", OrganizationRole.MEMBER],
        ["Can Kaya", "taylaniscan+7@gmail.com", OrganizationRole.MEMBER],
      ].map(([name, email, role], index) => ({
        id: `membership-${index}`,
        userId: `user-${index}`,
        name,
        email,
        role,
        membershipStatus: MembershipStatus.ACTIVE,
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-06-05T00:00:00.000Z"),
      })),
      pendingInvites: [],
    });

    const page = await AdminMembersPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("data-members-count=\"4\"");
    expect(membersManagementPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        members: expect.arrayContaining([
          expect.objectContaining({ email: "taylaniscan+4@gmail.com" }),
          expect.objectContaining({ email: "taylaniscan+5@gmail.com" }),
          expect.objectContaining({ email: "taylaniscan+6@gmail.com" }),
          expect.objectContaining({ email: "taylaniscan+7@gmail.com" }),
        ]),
      }),
      undefined
    );
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
    expect(getOrganizationAccessStateMock).toHaveBeenCalledWith(DEFAULT_ORGANIZATION_ID);
    expect(isStripeBillingConfiguredMock).toHaveBeenCalled();
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
    expect(markup).toContain("Workspace Identity");
    expect(markup).toContain("Billing &amp; subscription");
    expect(markup).toContain("View billing details");
    expect(markup).toContain("href=\"/settings/billing\"");
    expect(markup).toContain("Manage billing");
    expect(markup).toContain("action=\"/billing/recover\"");
    expect(markup).toContain("method=\"post\"");
    expect(markup).toContain("name=\"intent\"");
    expect(markup).toContain("value=\"open_billing_portal\"");
    expect(markup).not.toContain("/api/billing/portal");
    expect(markup).toContain("Growth");
    expect(markup).toContain("audit-list");
  });

  it.each([
    ["active", "open_billing_portal"],
    ["trialing", "open_billing_portal"],
    ["workspace_trial", "resume_subscription"],
    ["no_subscription", "resume_subscription"],
    ["trial_expired", "resume_subscription"],
  ] satisfies Array<
    [
      OrganizationAccessStateResult["reasonCode"],
      "open_billing_portal" | "resume_subscription",
    ]
  >)(
    "keeps the billing card visible on admin settings for %s state",
    async (reasonCode, expectedIntent) => {
      getOrganizationAccessStateMock.mockResolvedValueOnce(
        createAdminBillingState(reasonCode)
      );

      const page = await AdminSettingsPage();
      const markup = renderToStaticMarkup(page as React.ReactElement);

      expect(markup).toContain("Workspace Settings");
      expect(markup).toContain("Billing &amp; subscription");
      expect(markup).toContain("Manage billing");
      expect(markup).toContain("View billing details");
      expect(markup).toContain("action=\"/billing/recover\"");
      expect(markup).toContain(`value="${expectedIntent}"`);
      expect(markup).not.toContain("/api/billing/portal");
    }
  );

  it("keeps Manage billing visible and explains when Stripe config is missing", async () => {
    isStripeBillingConfiguredMock.mockReturnValueOnce(false);
    getMissingStripeBillingEnvKeysMock.mockReturnValueOnce([
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
    ]);

    const page = await AdminSettingsPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Billing &amp; subscription");
    expect(markup).toContain(
      "Billing provider is not configured in this environment."
    );
    expect(markup).toContain("STRIPE_SECRET_KEY");
    expect(markup).toContain("STRIPE_WEBHOOK_SECRET");
    expect(markup).toContain("Manage billing");
    expect(markup).toContain("action=\"/billing/recover\"");
    expect(markup).toContain("value=\"open_billing_portal\"");
  });

  it("renders read-only billing guidance for members on the settings page", async () => {
    requireOrganizationMock.mockResolvedValueOnce(
      createSessionUser({
        role: Role.TACTICAL_BUYER,
        activeOrganization: {
          membershipId: "membership-member",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.MEMBER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
    canManageOrganizationMembersMock.mockReturnValueOnce(false);

    const page = await AdminSettingsPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Workspace Settings");
    expect(markup).toContain("Billing &amp; subscription");
    expect(markup).toContain(
      "Billing is managed by workspace owners and admins."
    );
    expect(markup).toContain("View billing details");
    expect(markup).toContain("href=\"/settings/billing\"");
    expect(markup).not.toContain("Manage billing");
    expect(markup).not.toContain("action=\"/billing/recover\"");
    expect(workspaceSettingsFormMock).not.toHaveBeenCalled();
    expect(getOrganizationAdminAuditEventsMock).not.toHaveBeenCalled();
  });

  it("keeps billing visible when admin settings cannot verify billing status", async () => {
    getOrganizationAccessStateMock.mockRejectedValueOnce(
      new Error("Billing state query failed.")
    );

    const page = await AdminSettingsPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "admin.settings.billing_access_load_failed",
        route: "/admin/settings",
        organizationId: DEFAULT_ORGANIZATION_ID,
      })
    );
    expect(markup).toContain("Billing &amp; subscription");
    expect(markup).toContain("Billing status could not be verified.");
    expect(markup).toContain("Manage billing");
    expect(markup).toContain("action=\"/billing/recover\"");
    expect(markup).toContain("value=\"open_billing_portal\"");
    expect(markup).toContain("View billing details");
  });
});
