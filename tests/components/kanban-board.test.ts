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
import type { SavingCardPortfolio } from "@/lib/types";

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
    expect(markup).toContain("Realised");
    expect(markup).toContain("Achieved");
    expect(markup).toContain("Cancelled");
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
        "Cannot move from Idea to Achieved. You can only request Validated or Cancelled.",
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

  it("routes cancelled moves into the explicit cancellation flow", () => {
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
});
