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
      "Procurement Lead",
      "Category Owner",
      "Finance Reviewer",
    ],
  };
}

function createLockedSavingCard(): NonNullable<SavingCardFormProps["card"]> {
  return {
    id: "card-1",
    organizationId: "org-1",
    title: "Resin renegotiation",
    description: "Validated savings case.",
    savingType: "Hard savings - price reduction",
    phase: "VALIDATED",
    frequency: "RECURRING",
    supplierId: "supplier-1",
    materialId: "material-1",
    alternativeSupplierId: null,
    alternativeSupplierManualName: null,
    alternativeMaterialId: null,
    alternativeMaterialManualName: null,
    categoryId: "category-1",
    plantId: "plant-1",
    businessUnitId: "business-unit-1",
    buyerId: "buyer-1",
    baselinePrice: 15,
    newPrice: 12,
    annualVolume: 250,
    currency: "USD",
    fxRate: 1.25,
    calculatedSavings: 750,
    calculatedSavingsUSD: 600,
    savingDriver: "Negotiation",
    implementationComplexity: "Medium",
    qualificationStatus: "Validated",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-03-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-01T00:00:00.000Z"),
    financeLocked: true,
    cancellationReason: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    supplier: { id: "supplier-1", name: "Supplier A" },
    material: { id: "material-1", name: "PET Resin" },
    alternativeSupplier: null,
    alternativeMaterial: null,
    category: { id: "category-1", name: "Packaging" },
    plant: { id: "plant-1", name: "Amsterdam" },
    businessUnit: { id: "business-unit-1", name: "Beverages" },
    buyer: { id: "buyer-1", name: "Strategic Buyer" },
    evidence: [],
    stakeholders: [],
    comments: [],
    alternativeSuppliers: [],
    alternativeMaterials: [],
    approvals: [],
    phaseHistory: [],
    phaseChangeRequests: [],
  } as unknown as NonNullable<SavingCardFormProps["card"]>;
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
      "Required. Add a short business case so reviewers understand the initiative."
    );
    expect(markup).toContain("Workflow Status");
    expect(markup).toContain(
      "New cards start in Idea and move after workflow approval."
    );
    expect(markup).toContain(
      "Classify the case as hard savings, cost avoidance, supplier switch, material substitution, or another procurement value type."
    );
    expect(markup).toContain("Hard savings - price reduction");
    expect(markup).toContain("Cost avoidance - inflation mitigation");
    expect(markup).toContain(
      "Save first, then attach quote, contract/PO, invoice, and calculation evidence for finance validation."
    );
    expect(markup).toContain(
      "No buyers, suppliers, materials, categories, plants, and business units exist in this workspace yet."
    );
    expect(markup).toContain("No existing category yet");
    expect(markup).toContain("No existing buyer yet");
    expect(markup).toContain("No existing business unit yet");
    expect(markup).toContain("No existing plant yet");
    expect(markup).toContain(
      "Type the first category below. Traxium will create it in the active workspace when this card is saved."
    );
    expect(markup).toContain(
      "Type the first buyer below. Traxium will create it in the active workspace when this card is saved."
    );
    expect(markup).toContain(
      "Type the first business unit below. Traxium will create it in the active workspace when this card is saved."
    );
    expect(markup).toContain(
      "Type the first plant below. Traxium will create it in the active workspace when this card is saved."
    );
  });

  it("keeps inline creation guidance visible even when some lookup records already exist", () => {
    const markup = renderToStaticMarkup(
      React.createElement(SavingCardForm, {
        mode: "create",
        referenceData: createReferenceData({
          categories: [
            {
              id: "category-1",
              organizationId: "org-1",
              name: "Packaging",
              annualTarget: 0,
              createdAt: new Date("2026-04-01T00:00:00.000Z"),
              updatedAt: new Date("2026-04-01T00:00:00.000Z"),
            },
          ],
          buyers: [
            {
              id: "buyer-1",
              organizationId: "org-1",
              name: "Casey Buyer",
              email: null,
              createdAt: new Date("2026-04-01T00:00:00.000Z"),
              updatedAt: new Date("2026-04-01T00:00:00.000Z"),
            },
          ],
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

  it("renders finance-locked financial fields as disabled on edit", () => {
    const markup = renderToStaticMarkup(
      React.createElement(SavingCardForm, {
        mode: "edit",
        referenceData: createReferenceData(),
        card: createLockedSavingCard(),
      })
    );

    expect(markup).toContain("Finance lock active");
    expect(markup).toContain(
      "Baseline price, new price, annual volume, currency, FX rate, and value recognition dates are the core finance control points for this record."
    );
    expect(markup).toContain("Finance-controlled");
    expect(markup).toContain('disabled=""');
  });
});
