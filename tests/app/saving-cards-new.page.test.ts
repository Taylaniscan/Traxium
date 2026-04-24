import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SavingCardFormMock = vi.hoisted(() => vi.fn(() => null));
const requireUserMock = vi.hoisted(() => vi.fn());
const getReferenceDataMock = vi.hoisted(() => vi.fn());
const getWorkspaceReadinessMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/saving-cards/saving-card-form", () => ({
  SavingCardForm: SavingCardFormMock,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/data", () => ({
  getReferenceData: getReferenceDataMock,
  getWorkspaceReadiness: getWorkspaceReadinessMock,
}));

vi.mock("@/lib/observability", () => ({
  captureException: captureExceptionMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import NewSavingCardPage from "@/app/(app)/saving-cards/new/page";

describe("new saving card page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "user-1",
      organizationId: "org-1",
    });
    getReferenceDataMock.mockResolvedValue({
      users: [],
      buyers: [],
      suppliers: [],
      materials: [],
      categories: [],
      plants: [],
      businessUnits: [],
      fxRates: [],
    });
    getWorkspaceReadinessMock.mockResolvedValue(null);
  });

  it("keeps rendering the form when workspace readiness cannot be loaded", async () => {
    getWorkspaceReadinessMock.mockRejectedValueOnce(
      new Error("Workspace readiness query failed.")
    );

    const page = await NewSavingCardPage();
    const children = React.Children.toArray(page.props.children);
    const formElement = children.at(-1);

    expect(formElement).toMatchObject({
      type: SavingCardFormMock,
      props: {
        mode: "create",
        workspaceReadiness: undefined,
      },
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "saving_cards.new.page.readiness_load_failed",
        route: "/saving-cards/new",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
  });

  it("keeps first-card setup guidance inside the form instead of pushing users to settings", async () => {
    getWorkspaceReadinessMock.mockResolvedValueOnce({
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
      workflowCoverage: [],
      coverage: {
        masterDataReadyCount: 0,
        masterDataTotal: 6,
        workflowReadyCount: 0,
        workflowTotal: 0,
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
      missingWorkflowCoverage: [],
    });

    const page = await NewSavingCardPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("First-card setup can stay inside this form");
    expect(markup).toContain(
      "Buyers, suppliers, materials, categories, plants, and business units can all be created inline below."
    );
    expect(markup).toContain(
      "Stay in the saving card flow and create what you need inline first."
    );
    expect(markup).not.toContain("Open Settings");
  });
});
