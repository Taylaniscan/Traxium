import React from "react";
import { MembershipStatus, OrganizationRole, Role } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionUser } from "../helpers/security-fixtures";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
);
const useRouterMock = vi.hoisted(() => vi.fn());
const getWorkspaceOnboardingStateMock = vi.hoisted(() => vi.fn());
const bootstrapCurrentUserMock = vi.hoisted(() => vi.fn());
const getWorkspaceReadinessMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());
const workspaceOnboardingFormMock = vi.hoisted(() =>
  vi.fn(({ userName }: { userName: string }) =>
    React.createElement(
      "div",
      { "data-onboarding-form": userName },
      `form:${userName}`,
    ),
  ),
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: useRouterMock,
}));

vi.mock("@/lib/auth", () => ({
  getWorkspaceOnboardingState: getWorkspaceOnboardingStateMock,
  bootstrapCurrentUser: bootstrapCurrentUserMock,
}));

vi.mock("@/lib/data", () => ({
  getWorkspaceReadiness: getWorkspaceReadinessMock,
}));

vi.mock("@/lib/observability", () => ({
  captureException: captureExceptionMock,
}));

vi.mock("@/components/onboarding/workspace-onboarding-form", () => ({
  WorkspaceOnboardingForm: workspaceOnboardingFormMock,
}));

import { WorkspaceSetupGuide } from "@/components/onboarding/workspace-setup-guide";
import type { WorkspaceReadiness } from "@/lib/types";

import OnboardingPage from "@/app/onboarding/page";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function createWorkspaceReadiness(
  overrides: Partial<{
    counts: {
      users: number;
      buyers: number;
      suppliers: number;
      materials: number;
      categories: number;
      plants: number;
      businessUnits: number;
      savingCards: number;
    };
    coverage: {
      masterDataReadyCount: number;
      masterDataTotal: number;
      workflowReadyCount: number;
      workflowTotal: number;
      overallPercent: number;
    };
  }> = {},
) {
  const counts = {
    users: 1,
    buyers: 1,
    suppliers: 0,
    materials: 1,
    categories: 0,
    plants: 0,
    businessUnits: 0,
    savingCards: 1,
    ...overrides.counts,
  };

  return {
    workspace: {
      id: "org-1",
      name: "Atlas Procurement",
      description: "US manufacturing savings pilot for direct materials.",
      slug: "atlas-procurement",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    },
    counts,
    masterData: [
      {
        key: "buyers",
        label: "Buyers",
        count: counts.buyers,
        ready: counts.buyers > 0,
        description: "Commercial ownership for saving cards.",
      },
      {
        key: "suppliers",
        label: "Suppliers",
        count: counts.suppliers,
        ready: counts.suppliers > 0,
        description: "Baseline and alternative sourcing counterparties.",
      },
      {
        key: "materials",
        label: "Materials",
        count: counts.materials,
        ready: counts.materials > 0,
        description: "Material or part master records for sourcing cases.",
      },
      {
        key: "categories",
        label: "Categories",
        count: counts.categories,
        ready: counts.categories > 0,
        description: "Category ownership and savings target structure.",
      },
      {
        key: "plants",
        label: "Plants",
        count: counts.plants,
        ready: counts.plants > 0,
        description: "Operational scope for plant-level initiatives.",
      },
      {
        key: "businessUnits",
        label: "Business Units",
        count: counts.businessUnits,
        ready: counts.businessUnits > 0,
        description: "Reporting and accountability structure.",
      },
    ],
    workflowCoverage: [
      {
        key: "HEAD_OF_GLOBAL_PROCUREMENT",
        label: "Procurement Lead",
        count: 0,
        ready: false,
      },
      {
        key: "GLOBAL_CATEGORY_LEADER",
        label: "Category Owner",
        count: 0,
        ready: false,
      },
      {
        key: "FINANCIAL_CONTROLLER",
        label: "Finance Reviewer",
        count: 0,
        ready: false,
      },
    ],
    coverage: {
      masterDataReadyCount: 2,
      masterDataTotal: 6,
      workflowReadyCount: 0,
      workflowTotal: 3,
      overallPercent: 22,
      ...overrides.coverage,
    },
    activity: {
      firstSavingCardCreatedAt:
        counts.savingCards > 0 ? new Date("2026-04-02T00:00:00.000Z") : null,
      lastPortfolioUpdateAt:
        counts.savingCards > 0 ? new Date("2026-04-03T00:00:00.000Z") : null,
    },
    isMasterDataReady: false,
    isWorkflowReady: false,
    isWorkspaceReady: false,
    missingCoreSetup: ["Suppliers", "Categories", "Plants", "Business Units"],
    missingWorkflowCoverage: [
      "Procurement Lead",
      "Category Owner",
      "Finance Reviewer",
    ],
  };
}

describe("onboarding page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRouterMock.mockReturnValue({
      refresh: vi.fn(),
    });
  });

  it("renders the workspace creation step when the user still needs a workspace", async () => {
    getWorkspaceOnboardingStateMock.mockResolvedValueOnce({
      ok: true,
      needsWorkspace: true,
      user: {
        id: "user-1",
        name: "New User",
        email: "new.user@example.com",
      },
    });

    const page = await OnboardingPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("form:New User");
    expect(workspaceOnboardingFormMock).toHaveBeenCalledWith(
      {
        userName: "New User",
      },
      undefined,
    );
    expect(bootstrapCurrentUserMock).not.toHaveBeenCalled();
    expect(getWorkspaceReadinessMock).not.toHaveBeenCalled();
  });

  it("welcomes a returning workspace without repeating setup", async () => {
    getWorkspaceOnboardingStateMock.mockResolvedValueOnce({
      ok: true,
      needsWorkspace: false,
      user: {
        id: "user-1",
        name: "Taylor Buyer",
        email: "taylor@example.com",
      },
    });
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      repaired: false,
      user: createSessionUser({
        role: Role.TACTICAL_BUYER,
        activeOrganization: {
          membershipId: "membership-1",
          organizationId: "org-1",
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      }),
    });
    getWorkspaceReadinessMock.mockResolvedValueOnce(createWorkspaceReadiness());

    const page = await OnboardingPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Your work is underway.");
    expect(markup).toContain("Atlas Procurement");
    expect(markup).toContain("Open dashboard");
    expect(markup).toContain("Create another saving card");
    expect(markup).toContain("Continue later");
    expect(markup).not.toContain("Explore with sample cards");
  });

  it("starts an empty workspace with its team", async () => {
    getWorkspaceOnboardingStateMock.mockResolvedValueOnce({
      ok: true,
      needsWorkspace: false,
      user: {
        id: "user-1",
        name: "Taylor Buyer",
        email: "taylor@example.com",
      },
    });
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      repaired: false,
      user: createSessionUser({
        role: Role.TACTICAL_BUYER,
        activeOrganization: {
          membershipId: "membership-1",
          organizationId: "org-1",
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      }),
    });
    getWorkspaceReadinessMock.mockResolvedValueOnce(
      createWorkspaceReadiness({
        counts: {
          users: 1,
          buyers: 0,
          suppliers: 0,
          materials: 0,
          categories: 0,
          plants: 0,
          businessUnits: 0,
          savingCards: 0,
        },
        coverage: {
          masterDataReadyCount: 0,
          masterDataTotal: 6,
          workflowReadyCount: 0,
          workflowTotal: 3,
          overallPercent: 0,
        },
      }),
    );

    const page = await OnboardingPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Introduce your team.");
    expect(markup).toContain("Your materials");
    expect(markup).toContain("Your suppliers");
    expect(markup).toContain("Your categories");
    expect(markup).toContain("Production sites");
    expect(markup).toContain("Business units");
    expect(markup).toContain("First saving card");
    expect(markup).toContain("Upload your team");
    expect(markup).toContain("Add buyer");
    expect(markup).toContain("Invite a colleague");
    expect(markup).toContain("Skip for now");
    expect(markup).not.toContain("Choose a starting point");
  });

  it("keeps optional reporting gaps from blocking first-value readiness", async () => {
    getWorkspaceOnboardingStateMock.mockResolvedValueOnce({
      ok: true,
      needsWorkspace: false,
      user: {
        id: "user-1",
        name: "Taylor Buyer",
        email: "taylor@example.com",
      },
    });
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      repaired: false,
      user: createSessionUser({
        role: Role.TACTICAL_BUYER,
        activeOrganization: {
          membershipId: "membership-1",
          organizationId: "org-1",
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      }),
    });
    getWorkspaceReadinessMock.mockResolvedValueOnce(
      createWorkspaceReadiness({
        counts: {
          users: 1,
          buyers: 1,
          suppliers: 1,
          materials: 1,
          categories: 0,
          plants: 0,
          businessUnits: 0,
          savingCards: 1,
        },
        coverage: {
          masterDataReadyCount: 3,
          masterDataTotal: 6,
          workflowReadyCount: 0,
          workflowTotal: 3,
          overallPercent: 33,
        },
      }),
    );

    const page = await OnboardingPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Your work is underway.");
    expect(markup).not.toContain("Remaining blockers");
    expect(markup).toContain("Open dashboard");
  });

  it("keeps onboarding available when readiness cannot be loaded", async () => {
    getWorkspaceOnboardingStateMock.mockResolvedValueOnce({
      ok: true,
      needsWorkspace: false,
      user: {
        id: "user-1",
        name: "Taylor Buyer",
        email: "taylor@example.com",
      },
    });
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      repaired: false,
      user: createSessionUser({
        role: Role.TACTICAL_BUYER,
        activeOrganization: {
          membershipId: "membership-1",
          organizationId: "org-1",
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      }),
    });
    getWorkspaceReadinessMock.mockRejectedValueOnce(
      new Error("Workspace readiness query failed."),
    );

    const page = await OnboardingPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("We couldn’t refresh your workspace counts.");
    expect(markup).toContain("Introduce your team.");
    expect(markup).not.toContain("Explore with sample cards");
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "onboarding.page.readiness_load_failed",
        route: "/onboarding",
        organizationId: "org-1",
      }),
    );
  });

  it("keeps shared-data and invitation controls behind existing permissions", () => {
    const readiness = createWorkspaceReadiness();
    readiness.counts.buyers = 0;
    readiness.counts.savingCards = 0;
    const props = {
      readiness: readiness as WorkspaceReadiness,
      userName: "Alex",
      viewerMembershipRole: OrganizationRole.MEMBER,
    };
    const memberMarkup = renderToStaticMarkup(
      React.createElement(WorkspaceSetupGuide, {
        ...props,
        canManageData: false,
      }),
    );
    expect(memberMarkup).toContain("Introduce your team.");
    expect(memberMarkup).not.toContain("Add buyer");
    expect(memberMarkup).not.toContain("Upload your team");
    expect(memberMarkup).not.toContain("Create invitation");
    expect(memberMarkup).toContain("Ask a workspace owner or admin");

    const managerMarkup = renderToStaticMarkup(
      React.createElement(WorkspaceSetupGuide, {
        ...props,
        canManageData: true,
      }),
    );
    expect(managerMarkup).toContain("Add buyer");
    expect(managerMarkup).toContain("Upload your team");
    expect(managerMarkup).not.toContain("Create invitation");

    const ownerMarkup = renderToStaticMarkup(
      React.createElement(WorkspaceSetupGuide, {
        ...props,
        viewerMembershipRole: OrganizationRole.OWNER,
        canManageData: true,
      }),
    );
    expect(ownerMarkup).toContain("Create invitation");
  });

  it("shows an upload action for every shared-data step", () => {
    const cases = [
      ["materials", "Upload your materials", { buyers: 1 }],
      ["suppliers", "Upload your suppliers", { buyers: 1, materials: 1 }],
      [
        "categories",
        "Upload your categories",
        { buyers: 1, materials: 1, suppliers: 1 },
      ],
      [
        "plants",
        "Upload your production sites",
        { buyers: 1, materials: 1, suppliers: 1, categories: 1 },
      ],
      [
        "businessUnits",
        "Upload your business units",
        { buyers: 1, materials: 1, suppliers: 1, categories: 1, plants: 1 },
      ],
    ] as const;
    for (const [key, label, counts] of cases) {
      const readiness = createWorkspaceReadiness();
      Object.assign(
        readiness.counts,
        {
          buyers: 0,
          materials: 0,
          suppliers: 0,
          categories: 0,
          plants: 0,
          businessUnits: 0,
          savingCards: 0,
        },
        counts,
      );
      const markup = renderToStaticMarkup(
        React.createElement(WorkspaceSetupGuide, {
          readiness: readiness as WorkspaceReadiness,
          userName: "Alex",
          viewerMembershipRole: OrganizationRole.OWNER,
          canManageData: true,
        }),
      );
      expect(markup, key).toContain(label);
      expect(markup).toContain(`master-data-template/${key}?starter=1`);
    }
  });
});
