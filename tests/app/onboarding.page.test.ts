import React from "react";
import { MembershipStatus, OrganizationRole, Role } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionUser } from "../helpers/security-fixtures";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  })
);
const useRouterMock = vi.hoisted(() => vi.fn());
const getWorkspaceOnboardingStateMock = vi.hoisted(() => vi.fn());
const bootstrapCurrentUserMock = vi.hoisted(() => vi.fn());
const getWorkspaceReadinessMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());
const workspaceOnboardingFormMock = vi.hoisted(() =>
  vi.fn(({ userName }: { userName: string }) =>
    React.createElement("div", { "data-onboarding-form": userName }, `form:${userName}`)
  )
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

vi.mock("@/components/onboarding/first-value-launchpad", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react");

  return {
    FirstValueLaunchpad: ({
      title,
      description,
    }: {
      title?: string;
      description?: string;
    }) =>
      ReactModule.createElement(
        "div",
        { "data-launchpad": title ?? "launchpad" },
        `${title ?? "launchpad"}${description ? `:${description}` : ""}`
      ),
  };
});

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
  }> = {}
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
      description: "SME procurement savings pilot.",
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
        label: "Procurement Manager",
        count: 0,
        ready: false,
      },
      {
        key: "GLOBAL_CATEGORY_LEADER",
        label: "Procurement Specialist",
        count: 0,
        ready: false,
      },
      {
        key: "FINANCIAL_CONTROLLER",
        label: "Finance Approver",
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
      firstSavingCardCreatedAt: counts.savingCards > 0 ? new Date("2026-04-02T00:00:00.000Z") : null,
      lastPortfolioUpdateAt: counts.savingCards > 0 ? new Date("2026-04-03T00:00:00.000Z") : null,
    },
    isMasterDataReady: false,
    isWorkflowReady: false,
    isWorkspaceReady: false,
    missingCoreSetup: ["Suppliers", "Categories", "Plants", "Business Units"],
    missingWorkflowCoverage: [
      "Procurement Manager",
      "Procurement Specialist",
      "Finance Approver",
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
      undefined
    );
    expect(bootstrapCurrentUserMock).not.toHaveBeenCalled();
    expect(getWorkspaceReadinessMock).not.toHaveBeenCalled();
  });

  it("renders the readiness-driven guided setup for a new workspace", async () => {
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

    expect(markup).toContain("Set up Atlas Procurement for first value");
    expect(markup).toContain("2 of 7 steps completed");
    expect(markup).toContain("First-value progress");
    expect(markup).toContain("80%");
    expect(markup).toContain("Workspace identity");
    expect(markup).toContain("SME procurement savings pilot.");
    expect(markup).toContain("Business structure and master data");
    expect(markup).toContain("Buyers");
    expect(markup).toContain("Set up suppliers");
    expect(markup).toContain("Plants");
    expect(markup).toContain("Business Units");
    expect(markup).toContain("Current count");
    expect(markup).toContain("Upload first");
    expect(markup).toContain("Download template");
    expect(markup).toContain("Field guide");
    expect(markup).toContain("Accepted file types");
    expect(markup).toContain("Required columns");
    expect(markup).toContain("Optional columns");
    expect(markup).toContain("Example row");
    expect(markup).toContain("CSV (.csv)");
    expect(markup).toContain("Excel workbook (.xlsx)");
    expect(markup).toContain("name, code, country, contactEmail");
    expect(markup).toContain("Result summary");
    expect(markup).toContain("Team and roles");
    expect(markup).toContain("Financial Controller");
    expect(markup).toContain("Create first saving card");
    expect(markup).toContain("At least one saving card exists, so this step is complete.");
    expect(markup).toContain("Evidence and finance trust");
    expect(markup).toContain("Reporting and dashboard");
    expect(markup).toContain("Go to Dashboard");
    expect(markup).toContain("Go to Reports");
    expect(markup).toContain("Go to Kanban");
    expect(markup).toContain("Required for first value");
    expect(markup).toContain("Recommended for better reporting");
    expect(markup).toContain("Continue later");
    expect(markup).toContain('href="/dashboard"');
    expect(markup).toContain("data-launchpad=\"Training and acceleration\"");
  });

  it("shows first-value blockers for an empty workspace", async () => {
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
      })
    );

    const page = await OnboardingPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("20%");
    expect(markup).toContain("At least one buyer");
    expect(markup).toContain("At least one supplier");
    expect(markup).toContain("At least one material or category");
    expect(markup).toContain("At least one saving card");
    expect(markup).toContain("Remaining blockers");
    expect(markup).toContain("Create first saving card");
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
      })
    );

    const page = await OnboardingPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("100%");
    expect(markup).toContain("Your workspace is ready for first portfolio review.");
    expect(markup).toContain("Recommended gaps such as Plants, Business units, More complete categories");
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
      new Error("Workspace readiness query failed.")
    );

    const page = await OnboardingPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain(
      "Live workspace progress could not be refreshed right now."
    );
    expect(markup).toContain("Training and acceleration");
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "onboarding.page.readiness_load_failed",
        route: "/onboarding",
        organizationId: "org-1",
      })
    );
  });
});
