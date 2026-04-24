import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useRouterMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import { SavingCardForm } from "@/components/saving-cards/saving-card-form";

type SavingCardFormProps = React.ComponentProps<typeof SavingCardForm>;

function createReferenceData(
  overrides: Partial<SavingCardFormProps["referenceData"]> = {}
): SavingCardFormProps["referenceData"] {
  return {
    users: [],
    buyers: [],
    suppliers: [],
    materials: [],
    categories: [],
    plants: [],
    businessUnits: [],
    fxRates: [],
    ...overrides,
  } as SavingCardFormProps["referenceData"];
}

function createWorkspaceReadiness(): NonNullable<SavingCardFormProps["workspaceReadiness"]> {
  return {
    workspace: {
      id: "org-1",
      name: "Atlas Procurement",
      slug: "atlas-procurement",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
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
    },
    masterData: [
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
      masterDataReadyCount: 0,
      masterDataTotal: 6,
      workflowReadyCount: 0,
      workflowTotal: 3,
      overallPercent: 0,
    },
    activity: {
      firstSavingCardCreatedAt: null,
      lastPortfolioUpdateAt: null,
    },
    isMasterDataReady: false,
    isWorkflowReady: false,
    isWorkspaceReady: false,
    missingCoreSetup: [
      "Buyers",
      "Suppliers",
      "Materials",
      "Categories",
      "Plants",
      "Business Units",
    ],
    missingWorkflowCoverage: [
      "Procurement Manager",
      "Procurement Specialist",
      "Finance Approver",
    ],
  };
}

describe("saving card form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRouterMock.mockReturnValue({
      push: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
    });
  });

  it("prioritizes inline master-data creation when first-card setup starts empty", () => {
    const markup = renderToStaticMarkup(
      React.createElement(SavingCardForm, {
        mode: "create",
        referenceData: createReferenceData(),
        workspaceReadiness: createWorkspaceReadiness(),
      })
    );

    expect(markup).toContain(
      "Start with the card. Shared setup can happen inline."
    );
    expect(markup).toContain(
      "No buyers, suppliers, materials, and categories exist in this workspace yet."
    );
    expect(markup).toContain("No existing category yet");
    expect(markup).toContain("No existing buyer yet");
    expect(markup).toContain(
      "Type the first category below. Traxium will create it in the active workspace when this card is saved."
    );
    expect(markup).toContain(
      "Type the first buyer below. Traxium will create it in the active workspace when this card is saved."
    );
  });

  it("keeps inline creation guidance visible even when some lookup records already exist", () => {
    const markup = renderToStaticMarkup(
      React.createElement(SavingCardForm, {
        mode: "create",
        referenceData: createReferenceData({
          categories: [{ id: "category-1", name: "Packaging" }],
          buyers: [{ id: "buyer-1", name: "Casey Buyer" }],
        }),
        workspaceReadiness: createWorkspaceReadiness(),
      })
    );

    expect(markup).toContain("Create inline");
    expect(markup).toContain("1 category available");
    expect(markup).toContain("1 buyer available");
    expect(markup).toContain(
      "Need a new category? Type it below and continue without leaving the form."
    );
  });
});
