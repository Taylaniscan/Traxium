import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("@dnd-kit/core", () => ({
  closestCenter: vi.fn(() => []),
  DndContext: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  DragOverlay: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  getFirstCollision: vi.fn(() => null),
  KeyboardSensor: class KeyboardSensor {},
  PointerSensor: class PointerSensor {},
  pointerWithin: vi.fn(() => []),
  rectIntersection: vi.fn(() => []),
  useDroppable: () => ({
    isOver: false,
    setNodeRef: () => undefined,
  }),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  arrayMove: <T,>(items: T[], fromIndex: number, toIndex: number) => {
    const next = [...items];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    return next;
  },
  SortableContext: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setActivatorNodeRef: () => undefined,
    setNodeRef: () => undefined,
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import {
  applyKanbanMove,
  buildKanbanColumns,
  buildKanbanMoveOptions,
  cloneKanbanColumns,
  getVisibleKanbanPhase,
  KanbanBoard,
  previewKanbanCrossColumnMove,
  resolveKanbanMoveOutcome,
} from "@/components/kanban/kanban-board";
import { calculateSavings } from "@/lib/calculations";
import type { SavingCardPortfolio } from "@/lib/types";
import {
  getUtopiaTraxDatasetSummary,
  UTOPIATRAX_PENDING_PHASE_REQUESTS,
  UTOPIATRAX_SAVING_CARDS,
} from "@/scripts/seed-utopiatrax-demo";

function createSavingCard(
  overrides: Partial<SavingCardPortfolio> = {}
): SavingCardPortfolio {
  return {
    id: "card-1",
    title: "Packaging renegotiation",
    savingType: "COST_REDUCTION",
    phase: "IDEA",
    supplierId: "supplier-1",
    materialId: "material-1",
    categoryId: "category-1",
    businessUnitId: "business-unit-1",
    buyerId: "buyer-1",
    alternativeSupplierManualName: null,
    alternativeMaterialManualName: null,
    baselinePrice: 12,
    newPrice: 10,
    annualVolume: 1000,
    currency: "EUR",
    calculatedSavings: 125000,
    calculatedSavingsUSD: 135000,
    savingDriver: "Price renegotiation",
    implementationComplexity: "Low",
    qualificationStatus: "Approved",
    startDate: new Date("2026-03-01T00:00:00.000Z"),
    endDate: new Date("2026-09-01T00:00:00.000Z"),
    impactStartDate: new Date("2026-04-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-01T00:00:00.000Z"),
    financeLocked: false,
    supplier: {
      id: "supplier-1",
      name: "Atlas Chemicals",
    },
    material: {
      id: "material-1",
      name: "PET Resin",
    },
    alternativeSupplier: null,
    alternativeMaterial: null,
    category: {
      id: "category-1",
      name: "Packaging",
    },
    buyer: {
      id: "buyer-1",
      name: "Casey Buyer",
    },
    businessUnit: {
      id: "business-unit-1",
      name: "Beverages",
    },
    phaseChangeRequests: [],
    ...overrides,
  } as SavingCardPortfolio;
}

function createStableSeedId(prefix: string, value: string) {
  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function parseUtopiaDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function resolveUtopiaFxRate(
  currency: (typeof UTOPIATRAX_SAVING_CARDS)[number]["currency"]
) {
  return currency === "USD" ? 0.92 : 1;
}

function createUtopiaKanbanCards(): SavingCardPortfolio[] {
  return UTOPIATRAX_SAVING_CARDS.map((card, index) => {
    const impactStartDate = parseUtopiaDate(card.impactStart);
    const impactEndDate = parseUtopiaDate(card.impactEnd);
    const supplierId = createStableSeedId("supplier", card.supplierName);
    const materialId = createStableSeedId("material", card.materialName);
    const categoryId = createStableSeedId("category", card.categoryName);
    const buyerId = createStableSeedId("buyer", card.buyerName);
    const businessUnitId = createStableSeedId(
      "business-unit",
      card.businessUnitName
    );
    const savings = calculateSavings({
      baselinePrice: card.baselinePrice,
      newPrice: card.newPrice,
      annualVolume: card.annualVolume,
      currency: card.currency,
      fxRate: resolveUtopiaFxRate(card.currency),
    });
    const phaseChangeRequests = UTOPIATRAX_PENDING_PHASE_REQUESTS.filter(
      (request) => request.cardTitle === card.title
    ).map((request, requestIndex) => ({
      id: `utopiatrax-request-${index}-${requestIndex}`,
      approvalStatus: "PENDING",
      requestedPhase: request.requestedPhase,
      requestedBy: {
        id: createStableSeedId("user", request.requestedByEmail),
        name: request.requestedByEmail.includes("+7")
          ? "Can Kaya"
          : "Aylin Demir",
      },
    }));

    return {
      id: createStableSeedId("card", card.title),
      title: card.title,
      savingType: card.savingType,
      phase: card.phase,
      supplierId,
      materialId,
      categoryId,
      businessUnitId,
      buyerId,
      alternativeSupplierManualName: null,
      alternativeMaterialManualName: null,
      baselinePrice: card.baselinePrice,
      newPrice: card.newPrice,
      annualVolume: card.annualVolume,
      currency: card.currency,
      calculatedSavings: savings.savingsEUR,
      calculatedSavingsUSD: savings.savingsUSD,
      savingDriver: card.savingDriver,
      implementationComplexity: card.implementationComplexity,
      qualificationStatus: card.qualificationStatus,
      startDate: addUtcDays(impactStartDate, -75),
      endDate: addUtcDays(impactStartDate, -7),
      impactStartDate,
      impactEndDate,
      financeLocked: card.financeLocked ?? false,
      supplier: {
        id: supplierId,
        name: card.supplierName,
      },
      material: {
        id: materialId,
        name: card.materialName,
      },
      alternativeSupplier: card.alternativeSupplierName
        ? {
            id: createStableSeedId(
              "supplier",
              card.alternativeSupplierName
            ),
            name: card.alternativeSupplierName,
          }
        : null,
      alternativeMaterial: card.alternative?.materialName
        ? {
            id: createStableSeedId("material", card.alternative.materialName),
            name: card.alternative.materialName,
          }
        : null,
      category: {
        id: categoryId,
        name: card.categoryName,
      },
      buyer: {
        id: buyerId,
        name: card.buyerName,
      },
      businessUnit: {
        id: businessUnitId,
        name: card.businessUnitName,
      },
      phaseChangeRequests,
    } as SavingCardPortfolio;
  });
}

describe("kanban board", () => {
  it("renders all five columns", () => {
    const markup = renderToStaticMarkup(
      React.createElement(KanbanBoard, {
        initialCards: [createSavingCard()],
        readiness: null,
      })
    );

    expect(markup).toContain("Idea");
    expect(markup).toContain("Validated");
    expect(markup).toContain("Realized");
    expect(markup).toContain("Achieved");
    expect(markup).toContain("Canceled");
  });

  it("renders cards in the correct initial columns", () => {
    const columns = buildKanbanColumns([
      createSavingCard({ id: "idea-card", phase: "IDEA" }),
      createSavingCard({ id: "validated-card", phase: "VALIDATED" }),
      createSavingCard({
        id: "pending-card",
        phase: "IDEA",
        phaseChangeRequests: [
          {
            id: "request-1",
            approvalStatus: "PENDING",
            requestedPhase: "REALISED",
            requestedBy: {
              id: "user-1",
              name: "Casey Buyer",
            },
          },
        ],
      }),
    ]);

    expect(columns.IDEA.map((card) => card.id)).toEqual([
      "idea-card",
      "pending-card",
    ]);
    expect(columns.VALIDATED.map((card) => card.id)).toEqual([
      "validated-card",
    ]);
    expect(columns.REALISED.map((card) => card.id)).toEqual([]);
  });

  it("reorders cards within the same column", () => {
    const snapshot = buildKanbanColumns([
      createSavingCard({ id: "card-1", title: "First card" }),
      createSavingCard({ id: "card-2", title: "Second card" }),
    ]);

    const outcome = resolveKanbanMoveOutcome({
      snapshot,
      columns: snapshot,
      activeId: "card:card-2",
      overId: "card:card-1",
    });

    expect(outcome.type).toBe("reorder");
    if (outcome.type !== "reorder") {
      throw new Error("Expected reorder outcome");
    }

    expect(outcome.nextColumns.IDEA.map((card) => card.id)).toEqual([
      "card-2",
      "card-1",
    ]);
  });

  it("moves cards across columns", () => {
    const snapshot = buildKanbanColumns([createSavingCard()]);
    const preview = previewKanbanCrossColumnMove(
      snapshot,
      "card:card-1",
      "column:VALIDATED"
    );
    const outcome = resolveKanbanMoveOutcome({
      snapshot,
      columns: preview,
      activeId: "card:card-1",
      overId: "column:VALIDATED",
    });

    expect(outcome.type).toBe("move");
    if (outcome.type !== "move") {
      throw new Error("Expected move outcome");
    }

    expect(outcome.targetPhase).toBe("VALIDATED");
    expect(outcome.nextColumns.IDEA).toHaveLength(0);
    expect(outcome.nextColumns.VALIDATED).toHaveLength(1);
    expect(getVisibleKanbanPhase(outcome.nextColumns.VALIDATED[0])).toBe(
      "VALIDATED"
    );
  });

  it("resolves a cross-column drop when the pointer is over a card in the target column", () => {
    const snapshot = buildKanbanColumns([
      createSavingCard({ id: "card-1", title: "Packaging renegotiation" }),
      createSavingCard({
        id: "card-2",
        title: "Label redesign",
        phase: "VALIDATED",
      }),
    ]);
    const preview = previewKanbanCrossColumnMove(
      snapshot,
      "card:card-1",
      "card:card-2"
    );
    const outcome = resolveKanbanMoveOutcome({
      snapshot,
      columns: preview,
      activeId: "card:card-1",
      overId: "card:card-2",
    });

    expect(outcome.type).toBe("move");
    if (outcome.type !== "move") {
      throw new Error("Expected move outcome");
    }

    expect(outcome.targetPhase).toBe("VALIDATED");
    expect(outcome.nextColumns.VALIDATED.map((card) => card.id)).toContain(
      "card-1"
    );
  });

  it("does not preview invalid phase jumps across columns", () => {
    const snapshot = buildKanbanColumns([createSavingCard()]);
    const preview = previewKanbanCrossColumnMove(
      snapshot,
      "card:card-1",
      "column:ACHIEVED"
    );

    expect(preview).toEqual(snapshot);
  });

  it("shows a clear blocked-move outcome when workflow rules prevent a phase change", () => {
    const blockedCard = createSavingCard({
      phaseChangeRequests: [
        {
          id: "request-1",
          approvalStatus: "PENDING",
          requestedPhase: "VALIDATED",
          requestedBy: {
            id: "user-1",
            name: "Casey Buyer",
          },
        },
      ],
    });
    const snapshot = buildKanbanColumns([blockedCard]);

    expect(
      resolveKanbanMoveOutcome({
        snapshot,
        columns: snapshot,
        activeId: "card:card-1",
        overId: "column:REALISED",
      })
    ).toEqual({
      type: "blocked",
      nextColumns: snapshot,
      message:
        "Packaging renegotiation remains in Idea while approval is pending for Validated. Wait for that request to finish before moving it again.",
    });
  });

  it("shows a clear blocked-move outcome for invalid phase jumps", () => {
    const snapshot = buildKanbanColumns([createSavingCard()]);

    expect(
      resolveKanbanMoveOutcome({
        snapshot,
        columns: snapshot,
        activeId: "card:card-1",
        overId: "column:ACHIEVED",
      })
    ).toEqual({
      type: "blocked",
      nextColumns: snapshot,
      message:
        "Cannot move from Idea to Achieved. You can only request Validated or Canceled.",
    });
  });

  it("failed saves can revert local state back to the original snapshot", () => {
    const snapshot = buildKanbanColumns([createSavingCard()]);
    const optimisticColumns = applyKanbanMove(
      snapshot,
      "card-1",
      "VALIDATED",
      0,
      { optimistic: true }
    );
    const revertedColumns = cloneKanbanColumns(snapshot);

    expect(optimisticColumns.VALIDATED).toHaveLength(1);
    expect(revertedColumns.IDEA).toHaveLength(1);
    expect(revertedColumns.VALIDATED).toHaveLength(0);
  });

  it("no-op drags do not corrupt state", () => {
    const snapshot = buildKanbanColumns([createSavingCard()]);
    const outcome = resolveKanbanMoveOutcome({
      snapshot,
      columns: snapshot,
      activeId: "card:card-1",
      overId: "card:card-1",
    });

    expect(outcome.type).toBe("noop");
    expect(outcome.nextColumns.IDEA.map((card) => card.id)).toEqual([
      "card-1",
    ]);
  });

  it("routes canceled moves into the explicit cancellation flow", () => {
    const snapshot = buildKanbanColumns([createSavingCard()]);
    const outcome = resolveKanbanMoveOutcome({
      snapshot,
      columns: snapshot,
      activeId: "card:card-1",
      overId: "column:CANCELLED",
    });

    expect(outcome).toMatchObject({
      type: "requires_cancellation_reason",
      targetPhase: "CANCELLED",
    });
  });

  it("exposes fallback move options for non-dnd recovery", () => {
    expect(buildKanbanMoveOptions("IDEA")).toEqual(["VALIDATED", "CANCELLED"]);
    expect(buildKanbanMoveOptions("VALIDATED")).toEqual([
      "REALISED",
      "CANCELLED",
    ]);
    expect(buildKanbanMoveOptions("REALISED")).toEqual([
      "ACHIEVED",
      "CANCELLED",
    ]);
  });

  it("renders pending requests without relocating the card", () => {
    const markup = renderToStaticMarkup(
      React.createElement(KanbanBoard, {
        initialCards: [
          createSavingCard({
            phase: "IDEA",
            phaseChangeRequests: [
              {
                id: "request-1",
                approvalStatus: "PENDING",
                requestedPhase: "VALIDATED",
                requestedBy: {
                  id: "user-1",
                  name: "Casey Buyer",
                },
              },
            ],
          }),
        ],
        readiness: null,
      })
    );

    expect(markup).toContain("Pending approval");
    expect(markup).toContain("Pending move to Validated.");
    expect(markup).toContain("Card remains in Idea until approval completes.");
  });

  it("renders a visible error state when kanban data loading fails", () => {
    const markup = renderToStaticMarkup(
      React.createElement(KanbanBoard, {
        initialCards: [],
        readiness: null,
        loadState: {
          cardsError:
            "Kanban board data could not be loaded right now. Refresh the page or try again in a moment.",
        },
      })
    );

    expect(markup).toContain("Kanban board is unavailable");
    expect(markup).toContain("Refresh board");
  });

  it("keeps the UtopiaTrax demo portfolio coherent across columns and pending requests", () => {
    const cards = createUtopiaKanbanCards();
    const columns = buildKanbanColumns(cards);
    const summary = getUtopiaTraxDatasetSummary();
    const pendingCards = cards.filter(
      (card) => card.phaseChangeRequests.length > 0
    );

    expect(cards).toHaveLength(summary.savingCardCount);
    expect(pendingCards).toHaveLength(UTOPIATRAX_PENDING_PHASE_REQUESTS.length);

    for (const [phase, count] of Object.entries(summary.phaseCounts)) {
      expect(columns[phase as keyof typeof columns]).toHaveLength(count);
    }

    for (const card of pendingCards) {
      expect(columns[card.phase].map((columnCard) => columnCard.title)).toContain(
        card.title
      );
      expect(getVisibleKanbanPhase(card)).toBe(card.phase);
      expect(card.phaseChangeRequests[0]?.requestedPhase).not.toBe(card.phase);
    }

    const markup = renderToStaticMarkup(
      React.createElement(KanbanBoard, {
        initialCards: cards,
        readiness: null,
      })
    );

    expect(markup).toContain("Bio-based carrier pilot sourcing");
    expect(markup).toContain("Quinacridone red MOQ renegotiation");
    expect(markup).toContain("Pending approval");
    expect(markup).not.toContain("No saving cards yet");
  });
});
