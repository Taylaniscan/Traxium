import { ApprovalStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtimeStore = vi.hoisted(() => ({
  hooks: [] as unknown[],
  hookCursor: 0,
  dndHandlers: null as null | {
    onDragStart?: (event: { active: { id: string } }) => void;
    onDragOver?: (event: {
      active: { id: string };
      over: { id: string } | null;
    }) => void;
    onDragEnd?: (event: {
      active: { id: string };
      over: { id: string } | null;
    }) => void;
    onDragCancel?: () => void;
  },
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  function useState<T>(
    initialState: T | (() => T)
  ): [T, (value: T | ((current: T) => T)) => void] {
    const hookIndex = runtimeStore.hookCursor++;

    if (!(hookIndex in runtimeStore.hooks)) {
      runtimeStore.hooks[hookIndex] =
        typeof initialState === "function"
          ? (initialState as () => T)()
          : initialState;
    }

    const setState = (value: T | ((current: T) => T)) => {
      const current = runtimeStore.hooks[hookIndex] as T;
      runtimeStore.hooks[hookIndex] =
        typeof value === "function" ? (value as (current: T) => T)(current) : value;
    };

    return [runtimeStore.hooks[hookIndex] as T, setState];
  }

  function useRef<T>(initialValue: T) {
    const hookIndex = runtimeStore.hookCursor++;

    if (!(hookIndex in runtimeStore.hooks)) {
      runtimeStore.hooks[hookIndex] = {
        current: initialValue,
      };
    }

    return runtimeStore.hooks[hookIndex] as { current: T };
  }

  return {
    ...actual,
    useRef,
    useState,
  };
});

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: {
    children: unknown;
    href: string;
    prefetch?: boolean;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("@dnd-kit/core", () => ({
  closestCenter: vi.fn(() => []),
  DndContext: ({
    children,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel,
  }: {
    children?: unknown;
    onDragStart?: (event: { active: { id: string } }) => void;
    onDragOver?: (event: {
      active: { id: string };
      over: { id: string } | null;
    }) => void;
    onDragEnd?: (event: {
      active: { id: string };
      over: { id: string } | null;
    }) => void;
    onDragCancel?: () => void;
  }) => {
    // Full pointer-driven DnD is not stable in this Node-only test runtime.
    // We keep the real board state machine and drive the DndContext callbacks
    // directly so regressions in move handling still surface.
    runtimeStore.dndHandlers = {
      onDragStart,
      onDragOver,
      onDragEnd,
      onDragCancel,
    };

    return React.createElement("div", { "data-dnd-context": true }, children);
  },
  DragOverlay: ({ children }: { children?: unknown }) =>
    React.createElement("div", { "data-drag-overlay": true }, children),
  getFirstCollision: vi.fn((collisions: Array<{ id: string }> | null | undefined) =>
    collisions?.[0]?.id ?? null
  ),
  KeyboardSensor: class KeyboardSensor {},
  PointerSensor: class PointerSensor {},
  pointerWithin: vi.fn(() => []),
  rectIntersection: vi.fn(() => []),
  useDroppable: ({ id }: { id: string }) => ({
    isOver: false,
    setNodeRef: () => undefined,
    id,
  }),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
}));

vi.mock("@dnd-kit/sortable", () => ({
  arrayMove: <T,>(items: T[], fromIndex: number, toIndex: number) => {
    const next = [...items];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    return next;
  },
  SortableContext: ({ children }: { children?: unknown }) =>
    React.createElement("div", { "data-sortable-context": true }, children),
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: ({ id }: { id: string }) => ({
    attributes: {
      "data-sortable-id": id,
    },
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

import * as React from "react";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import { KanbanBoard } from "@/components/kanban/kanban-board";
import type { SavingCardPortfolio } from "@/lib/types";

type RuntimeTextNode = string;

type RuntimeElementNode = {
  type: string;
  props: Record<string, unknown>;
  children: RuntimeNode[];
};

type RuntimeNode = RuntimeTextNode | RuntimeElementNode;

const forwardRefSymbol = Symbol.for("react.forward_ref");
const memoSymbol = Symbol.for("react.memo");

function resetRuntimeStore() {
  runtimeStore.hooks.length = 0;
  runtimeStore.hookCursor = 0;
  runtimeStore.dndHandlers = null;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
}

function resolveRuntimeNode(node: unknown): RuntimeNode[] {
  if (node === null || node === undefined || typeof node === "boolean") {
    return [];
  }

  if (typeof node === "string" || typeof node === "number") {
    return [String(node)];
  }

  if (Array.isArray(node)) {
    return node.flatMap(resolveRuntimeNode);
  }

  if (!React.isValidElement(node)) {
    return [];
  }

  const element = node as React.ReactElement<{
    children?: React.ReactNode;
  }>;

  if (element.type === React.Fragment) {
    return resolveRuntimeNode(element.props.children);
  }

  if (typeof element.type === "string") {
    const { children, ...props } = element.props;

    return [
      {
        type: element.type,
        props,
        children: resolveRuntimeNode(children),
      },
    ];
  }

  if (typeof element.type === "function") {
    return resolveRuntimeNode(
      (element.type as (props: Record<string, unknown>) => unknown)(element.props)
    );
  }

  if (
    typeof element.type === "object" &&
    element.type !== null &&
    "render" in element.type &&
    (element.type as { $$typeof?: symbol }).$$typeof === forwardRefSymbol
  ) {
    return resolveRuntimeNode(
      (
        element.type as {
          render: (
            props: Record<string, unknown>,
            ref: React.Ref<unknown> | null
          ) => unknown;
        }
      ).render(element.props, null)
    );
  }

  if (
    typeof element.type === "object" &&
    element.type !== null &&
    "type" in element.type &&
    (element.type as { $$typeof?: symbol }).$$typeof === memoSymbol
  ) {
    return resolveRuntimeNode(
      React.createElement(
        (
          element.type as {
            type: React.ComponentType<Record<string, unknown>>;
          }
        ).type,
        element.props
      )
    );
  }

  return [];
}

function collectText(node: RuntimeNode | RuntimeNode[]) {
  if (Array.isArray(node)) {
    return normalizeText(node.map((child) => collectText(child)).join(" "));
  }

  if (typeof node === "string") {
    return node;
  }

  return normalizeText(node.children.map((child) => collectText(child)).join(" "));
}

function findAllNodes(
  node: RuntimeNode | RuntimeNode[],
  predicate: (current: RuntimeElementNode) => boolean
): RuntimeElementNode[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => findAllNodes(child, predicate));
  }

  if (typeof node === "string") {
    return [];
  }

  const matches = predicate(node) ? [node] : [];
  return [...matches, ...node.children.flatMap((child) => findAllNodes(child, predicate))];
}

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

function createBoardRuntime(initialCards: SavingCardPortfolio[]) {
  let tree: RuntimeNode[] = [];

  function render() {
    runtimeStore.hookCursor = 0;
    runtimeStore.dndHandlers = null;
    tree = resolveRuntimeNode(
      React.createElement(KanbanBoard, {
        initialCards,
        readiness: null,
      })
    );
    return tree;
  }

  function getColumnText(phase: SavingCardPortfolio["phase"]) {
    const column = findAllNodes(
      tree,
      (node) => node.props["data-phase"] === phase
    ).at(0);

    if (!column) {
      throw new Error(`Missing column for phase ${phase}`);
    }

    return collectText(column);
  }

  function getSelectOptionLabels(label: string) {
    const select = findAllNodes(
      tree,
      (node) => node.type === "select" && node.props["aria-label"] === label
    ).at(0);

    if (!select) {
      throw new Error(`Missing select with aria-label "${label}"`);
    }

    return findAllNodes(select, (node) => node.type === "option").map((option) =>
      collectText(option)
    );
  }

  function getText() {
    return collectText(tree);
  }

  function getDragHandle(cardTitle: string) {
    const handle = findAllNodes(
      tree,
      (node) =>
        node.type === "button" &&
        node.props["data-kanban-drag-handle"] !== undefined &&
        node.props["aria-label"] === `Drag ${cardTitle}`
    ).at(0);

    if (!handle) {
      throw new Error(`Missing drag handle for "${cardTitle}"`);
    }

    return handle;
  }

  function getDndHandlers() {
    if (!runtimeStore.dndHandlers) {
      throw new Error("DndContext handlers were not captured.");
    }

    return runtimeStore.dndHandlers;
  }

  render();

  return {
    render,
    getColumnText,
    getDndHandlers,
    getDragHandle,
    getSelectOptionLabels,
    getText,
  };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function dragCardToPhase(input: {
  runtime: ReturnType<typeof createBoardRuntime>;
  cardId: string;
  targetPhase: SavingCardPortfolio["phase"];
}) {
  let handlers = input.runtime.getDndHandlers();
  handlers.onDragStart?.({
    active: {
      id: `card:${input.cardId}`,
    },
  });
  input.runtime.render();

  handlers = input.runtime.getDndHandlers();
  handlers.onDragOver?.({
    active: {
      id: `card:${input.cardId}`,
    },
    over: {
      id: `column:${input.targetPhase}`,
    },
  });
  input.runtime.render();

  handlers = input.runtime.getDndHandlers();
  handlers.onDragEnd?.({
    active: {
      id: `card:${input.cardId}`,
    },
    over: {
      id: `column:${input.targetPhase}`,
    },
  });
  input.runtime.render();
}

describe("kanban board runtime regression", () => {
  beforeEach(() => {
    resetRuntimeStore();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetRuntimeStore();
  });

  it("wires the visible grip handle as the sortable activator with touch-safe pointer behavior", () => {
    const runtime = createBoardRuntime([createSavingCard()]);
    const handle = runtime.getDragHandle("Packaging renegotiation");

    expect(handle.props["data-kanban-drag-handle"]).toBe("card-1");
    expect(handle.props["data-sortable-id"]).toBe("card:card-1");
    expect(handle.props["aria-label"]).toBe("Drag Packaging renegotiation");
    expect(handle.props.style).toEqual(
      expect.objectContaining({
        touchAction: "none",
      })
    );
  });

  it("submits a valid next-step move and keeps the card in its persisted column while approval is pending", async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "request-1",
        approvalStatus: ApprovalStatus.PENDING,
        requestedPhase: "VALIDATED",
        requestedBy: {
          id: "user-1",
          name: "Casey Buyer",
        },
        savingCard: {
          phase: "IDEA",
        },
      }),
    });

    const runtime = createBoardRuntime([createSavingCard()]);

    expect(runtime.getColumnText("IDEA")).toContain("Packaging renegotiation");
    expect(runtime.getColumnText("VALIDATED")).not.toContain(
      "Packaging renegotiation"
    );
    expect(
      runtime.getSelectOptionLabels("Move Packaging renegotiation to")
    ).toEqual(["Move to...", "Validated", "Cancelled"]);

    await dragCardToPhase({
      runtime,
      cardId: "card-1",
      targetPhase: "VALIDATED",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/phase-change-request",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })
    );
    expect(
      JSON.parse(
        (
          fetchMock.mock.calls[0]?.[1] as {
            body?: string;
          }
        ).body ?? "{}"
      )
    ).toEqual({
      savingCardId: "card-1",
      requestedPhase: "VALIDATED",
    });

    expect(runtime.getColumnText("IDEA")).toContain("Packaging renegotiation");
    expect(runtime.getColumnText("IDEA")).toContain("Requesting...");
    expect(runtime.getColumnText("VALIDATED")).not.toContain(
      "Packaging renegotiation"
    );
    expect(runtime.getText()).not.toContain("Move blocked");

    await flushAsyncWork();
    runtime.render();

    expect(runtime.getText()).toContain("Board updated");
    expect(runtime.getText()).toContain(
      "Packaging renegotiation remains in Idea while approval is pending for Validated."
    );
    expect(runtime.getColumnText("IDEA")).toContain("Pending approval");
    expect(runtime.getColumnText("IDEA")).toContain(
      "Pending move to Validated. Card remains in Idea until approval completes."
    );
    expect(runtime.getColumnText("VALIDATED")).not.toContain(
      "Packaging renegotiation"
    );
  });

  it("shows a visible blocked notice for invalid jumps and keeps the card in its persisted column", async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const runtime = createBoardRuntime([createSavingCard()]);

    expect(
      runtime.getSelectOptionLabels("Move Packaging renegotiation to")
    ).toEqual(["Move to...", "Validated", "Cancelled"]);
    expect(
      runtime.getSelectOptionLabels("Move Packaging renegotiation to")
    ).not.toContain("Achieved");

    await dragCardToPhase({
      runtime,
      cardId: "card-1",
      targetPhase: "ACHIEVED",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(runtime.getText()).toContain("Move blocked");
    expect(runtime.getText()).toContain(
      "Cannot move from Idea to Achieved. You can only request Validated or Cancelled."
    );
    expect(runtime.getColumnText("IDEA")).toContain("Packaging renegotiation");
    expect(runtime.getColumnText("ACHIEVED")).not.toContain(
      "Packaging renegotiation"
    );
  });
});
