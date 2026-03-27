import React from "react";
import { MembershipStatus, OrganizationRole, Role } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceReadiness } from "@/lib/types";
import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  createSessionUser,
} from "../helpers/security-fixtures";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  })
);

const bootstrapCurrentUserMock = vi.hoisted(() => vi.fn());
const getCurrentUserMock = vi.hoisted(() => vi.fn());
const loadFirstValueSampleDataMock = vi.hoisted(() => vi.fn());
const appShellMock = vi.hoisted(() =>
  vi.fn(({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-shell": "app" }, children)
  )
);
const mockFirstValueError = vi.hoisted(
  () =>
    class MockFirstValueError extends Error {
      constructor(
        message: string,
        readonly status: 400 | 401 | 403 | 404 | 409 = 400
      ) {
        super(message);
        this.name = "FirstValueError";
      }
    }
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  bootstrapCurrentUser: bootstrapCurrentUserMock,
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: appShellMock,
}));

vi.mock("@/lib/first-value", () => ({
  FirstValueError: mockFirstValueError,
  loadFirstValueSampleData: loadFirstValueSampleDataMock,
}));

import AppLayout from "@/app/(app)/layout";
import { POST as postSampleDataRoute } from "@/app/api/onboarding/sample-data/route";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

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
    isMasterDataReady: boolean;
    isWorkflowReady: boolean;
    isWorkspaceReady: boolean;
    missingCoreSetup: string[];
    missingWorkflowCoverage: string[];
  }> = {}
): WorkspaceReadiness {
  const masterData: WorkspaceReadiness["masterData"] = [
    {
      key: "buyers",
      label: "Buyers",
      count: 0,
      ready: false,
      description: "Commercial ownership for saving cards.",
    },
    {
      key: "suppliers",
      label: "Suppliers",
      count: 0,
      ready: false,
      description: "Baseline and alternative sourcing counterparties.",
    },
    {
      key: "materials",
      label: "Materials",
      count: 0,
      ready: false,
      description: "Material or part master records for sourcing cases.",
    },
    {
      key: "categories",
      label: "Categories",
      count: 0,
      ready: false,
      description: "Category ownership and savings target structure.",
    },
    {
      key: "plants",
      label: "Plants",
      count: 0,
      ready: false,
      description: "Operational scope for plant-level initiatives.",
    },
    {
      key: "businessUnits",
      label: "Business Units",
      count: 0,
      ready: false,
      description: "Reporting and accountability structure.",
    },
  ];
  const workflowCoverage: WorkspaceReadiness["workflowCoverage"] = [
    {
      key: "HEAD_OF_GLOBAL_PROCUREMENT",
      label: "Head of Global Procurement",
      count: 0,
      ready: false,
    },
    {
      key: "GLOBAL_CATEGORY_LEADER",
      label: "Global Category Leader",
      count: 0,
      ready: false,
    },
    {
      key: "FINANCIAL_CONTROLLER",
      label: "Financial Controller",
      count: 0,
      ready: false,
    },
  ];

  return {
    workspace: {
      id: DEFAULT_ORGANIZATION_ID,
      name: "Atlas Procurement",
      slug: "atlas-procurement",
      createdAt: new Date("2026-03-24T10:00:00.000Z"),
      updatedAt: new Date("2026-03-24T10:00:00.000Z"),
    },
    counts: {
      users: 1,
      buyers: 0,
      suppliers: 0,
      materials: 0,
      categories: 0,
      plants: 0,
      businessUnits: 0,
      savingCards: 0,
      ...overrides.counts,
    },
    masterData,
    workflowCoverage,
    coverage: {
      masterDataReadyCount: 0,
      masterDataTotal: 6,
      workflowReadyCount: 0,
      workflowTotal: 3,
      overallPercent: 0,
      ...overrides.coverage,
    },
    activity: {
      firstSavingCardCreatedAt: null,
      lastPortfolioUpdateAt: null,
    },
    isMasterDataReady: false,
    isWorkflowReady: false,
    isWorkspaceReady: false,
    missingCoreSetup: ["Buyers", "Suppliers", "Materials", "Categories", "Plants", "Business Units"],
    missingWorkflowCoverage: [
      "Head of Global Procurement",
      "Global Category Leader",
      "Financial Controller",
    ],
    ...overrides,
  };
}

describe("first-value onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects a user without memberships to onboarding from protected app layout", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: false,
      code: "ORGANIZATION_ACCESS_REQUIRED",
      message: "Your account is not an active member of any Traxium organization.",
    });

    await expect(
      AppLayout({
        children: React.createElement("div", null, "workspace"),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/onboarding");

    expect(appShellMock).not.toHaveBeenCalled();
  });

  it("renders a meaningful first-value empty state for an empty workspace", () => {
    const markup = renderToStaticMarkup(
      React.createElement(DashboardClient, {
        data: {
          cards: [],
        },
        readiness: createWorkspaceReadiness(),
        viewer: {
          organizationMembershipRole: OrganizationRole.ADMIN,
        },
      })
    );

    expect(markup).toContain("No live saving cards yet.");
    expect(markup).toContain("Start first record");
    expect(markup).toContain("Load sample data");
    expect(markup).toContain("Invite teammate");
  });

  it("writes sample data only into the active organization", async () => {
    getCurrentUserMock.mockResolvedValueOnce(
      createSessionUser({
        id: DEFAULT_USER_ID,
        organizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganization: {
          membershipId: "membership-1",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
    loadFirstValueSampleDataMock.mockResolvedValueOnce({
      organizationId: DEFAULT_ORGANIZATION_ID,
      createdCardsCount: 2,
      createdSavingCards: [
        {
          id: "card-1",
          title: "PET Resin Renegotiation Wave 1",
          phase: "VALIDATED",
        },
        {
          id: "card-2",
          title: "Secondary Label Stock Harmonization",
          phase: "IDEA",
        },
      ],
    });

    const response = await postSampleDataRoute(
      new Request("http://localhost/api/onboarding/sample-data", {
        method: "POST",
      })
    );

    expect(loadFirstValueSampleDataMock).toHaveBeenCalledWith(
      DEFAULT_USER_ID,
      DEFAULT_ORGANIZATION_ID
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      organizationId: DEFAULT_ORGANIZATION_ID,
      createdCardsCount: 2,
      createdSavingCards: [
        {
          id: "card-1",
          title: "PET Resin Renegotiation Wave 1",
          phase: "VALIDATED",
        },
        {
          id: "card-2",
          title: "Secondary Label Stock Harmonization",
          phase: "IDEA",
        },
      ],
    });
  });

  it("keeps the normal app flow once onboarding is complete", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      repaired: false,
      user: createSessionUser({
        role: Role.GLOBAL_CATEGORY_LEADER,
      }),
    });

    const layout = await AppLayout({
      children: React.createElement("section", null, "dashboard-ready"),
    });
    const markup = renderToStaticMarkup(layout as React.ReactElement);

    expect(appShellMock).toHaveBeenCalledTimes(1);
    expect(markup).toContain("dashboard-ready");
  });
});
