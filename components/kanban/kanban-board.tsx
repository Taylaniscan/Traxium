"use client";

import { ApprovalStatus } from "@prisma/client";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  getFirstCollision,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { phaseLabels, phases } from "@/lib/constants";
import type { SavingCardPortfolio, WorkspaceReadiness } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/numberFormatter";

type KanbanPhase = SavingCardPortfolio["phase"];
type KanbanColumns = Record<KanbanPhase, SavingCardPortfolio[]>;

type KanbanPhaseChangeRequestSummary =
  SavingCardPortfolio["phaseChangeRequests"][number];

type KanbanPhaseChangeRouteResult = KanbanPhaseChangeRequestSummary & {
  approvalStatus: ApprovalStatus;
  savingCard?: {
    phase: KanbanPhase;
  } | null;
};

type KanbanNotice = {
  tone: "error" | "success" | "warning";
  message: string;
} | null;

type CancellationDraft = {
  cardId: string;
  targetPhase: KanbanPhase;
};

type KanbanCardLocation = {
  phase: KanbanPhase;
  index: number;
  card: SavingCardPortfolio;
};

type KanbanMoveOutcome =
  | {
      type: "noop";
      nextColumns: KanbanColumns;
    }
  | {
      type: "reorder";
      nextColumns: KanbanColumns;
    }
  | {
      type: "blocked";
      nextColumns: KanbanColumns;
      message: string;
    }
  | {
      type: "requires_cancellation_reason";
      nextColumns: KanbanColumns;
      card: SavingCardPortfolio;
      targetPhase: KanbanPhase;
    }
  | {
      type: "move";
      nextColumns: KanbanColumns;
      card: SavingCardPortfolio;
      targetPhase: KanbanPhase;
    };

export type KanbanBoardLoadState = {
  cardsError?: string | null;
  readinessError?: string | null;
};

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function normalizeSavings(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getKanbanCardDragId(cardId: string) {
  return `card:${cardId}`;
}

function getKanbanColumnId(phase: KanbanPhase) {
  return `column:${phase}`;
}

function parseKanbanCardDragId(value: string) {
  return value.startsWith("card:") ? value.slice("card:".length) : value;
}

function parseKanbanColumnId(value: string) {
  if (!value.startsWith("column:")) {
    return null;
  }

  const phase = value.slice("column:".length) as KanbanPhase;
  return phases.includes(phase) ? phase : null;
}

export function getPendingKanbanPhaseChangeRequest(card: SavingCardPortfolio) {
  return (
    card.phaseChangeRequests.find(
      (request) => request.approvalStatus === ApprovalStatus.PENDING
    ) ?? null
  );
}

export function getVisibleKanbanPhase(card: SavingCardPortfolio): KanbanPhase {
  return getPendingKanbanPhaseChangeRequest(card)?.requestedPhase ?? card.phase;
}

export function buildKanbanColumns(cards: SavingCardPortfolio[]): KanbanColumns {
  return cards.reduce<KanbanColumns>(
    (columns, card) => {
      columns[getVisibleKanbanPhase(card)].push(card);
      return columns;
    },
    {
      IDEA: [],
      VALIDATED: [],
      REALISED: [],
      ACHIEVED: [],
      CANCELLED: [],
    }
  );
}

export function cloneKanbanColumns(columns: KanbanColumns): KanbanColumns {
  return {
    IDEA: [...columns.IDEA],
    VALIDATED: [...columns.VALIDATED],
    REALISED: [...columns.REALISED],
    ACHIEVED: [...columns.ACHIEVED],
    CANCELLED: [...columns.CANCELLED],
  };
}

export function buildKanbanMoveOptions(currentPhase: KanbanPhase) {
  return phases.filter((phase) => phase !== currentPhase);
}

type KanbanColumnsUpdater =
  | KanbanColumns
  | ((current: KanbanColumns) => KanbanColumns);

function findKanbanCardLocation(
  columns: KanbanColumns,
  cardId: string
): KanbanCardLocation | null {
  for (const phase of phases) {
    const index = columns[phase].findIndex((card) => card.id === cardId);

    if (index >= 0) {
      return {
        phase,
        index,
        card: columns[phase][index],
      };
    }
  }

  return null;
}

function findKanbanPhaseForDragId(
  columns: KanbanColumns,
  dragId: string | null
): KanbanPhase | null {
  if (!dragId) {
    return null;
  }

  const columnPhase = parseKanbanColumnId(dragId);
  if (columnPhase) {
    return columnPhase;
  }

  const cardId = parseKanbanCardDragId(dragId);
  return findKanbanCardLocation(columns, cardId)?.phase ?? null;
}

function areCardOrdersEqual(
  left: SavingCardPortfolio[],
  right: SavingCardPortfolio[]
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((card, index) => card.id === right[index]?.id);
}

export function applyKanbanMove(
  columns: KanbanColumns,
  cardId: string,
  targetPhase: KanbanPhase,
  targetIndex: number,
  options?: {
    optimistic?: boolean;
  }
) {
  const location = findKanbanCardLocation(columns, cardId);

  if (!location) {
    return columns;
  }

  const nextColumns = cloneKanbanColumns(columns);
  const sourceCards = [...nextColumns[location.phase]];
  const [removedCard] = sourceCards.splice(location.index, 1);

  if (!removedCard) {
    return columns;
  }

  if (location.phase === targetPhase) {
    const boundedIndex = Math.max(
      0,
      Math.min(targetIndex, nextColumns[targetPhase].length - 1)
    );

    if (location.index === boundedIndex) {
      return columns;
    }

    nextColumns[targetPhase] = arrayMove(
      nextColumns[targetPhase],
      location.index,
      boundedIndex
    );
    return nextColumns;
  }

  const movedCard = options?.optimistic
    ? {
        ...removedCard,
        phase: targetPhase,
      }
    : {
        ...removedCard,
        phase: targetPhase,
      };

  nextColumns[location.phase] = sourceCards;
  const boundedIndex = Math.max(
    0,
    Math.min(targetIndex, nextColumns[targetPhase].length)
  );
  nextColumns[targetPhase].splice(boundedIndex, 0, movedCard);
  return nextColumns;
}

function reorderKanbanWithinColumn(
  columns: KanbanColumns,
  phase: KanbanPhase,
  activeCardId: string,
  overId: string
) {
  const phaseCards = columns[phase];
  const activeIndex = phaseCards.findIndex((card) => card.id === activeCardId);

  if (activeIndex === -1) {
    return columns;
  }

  const overColumnPhase = parseKanbanColumnId(overId);
  const overCardId = parseKanbanCardDragId(overId);
  const overIndex =
    overColumnPhase === phase
      ? phaseCards.length - 1
      : phaseCards.findIndex((card) => card.id === overCardId);

  if (overIndex === -1 || overIndex === activeIndex) {
    return columns;
  }

  return applyKanbanMove(columns, activeCardId, phase, overIndex);
}

export function previewKanbanCrossColumnMove(
  columns: KanbanColumns,
  activeId: string,
  overId: string | null
) {
  if (!overId) {
    return columns;
  }

  const activeCardId = parseKanbanCardDragId(activeId);
  const activeLocation = findKanbanCardLocation(columns, activeCardId);
  const targetPhase = findKanbanPhaseForDragId(columns, overId);

  if (!activeLocation || !targetPhase || activeLocation.phase === targetPhase) {
    return columns;
  }

  if (
    getPendingKanbanPhaseChangeRequest(activeLocation.card) ||
    targetPhase === "CANCELLED"
  ) {
    return columns;
  }

  const overColumnPhase = parseKanbanColumnId(overId);
  const overCardId = parseKanbanCardDragId(overId);
  const targetCards = columns[targetPhase];
  const targetIndex =
    overColumnPhase === targetPhase
      ? targetCards.length
      : targetCards.findIndex((card) => card.id === overCardId);

  return applyKanbanMove(
    columns,
    activeCardId,
    targetPhase,
    targetIndex >= 0 ? targetIndex : targetCards.length
  );
}

export function resolveKanbanMoveOutcome(input: {
  snapshot: KanbanColumns;
  columns: KanbanColumns;
  activeId: string;
  overId: string | null;
}): KanbanMoveOutcome {
  const activeCardId = parseKanbanCardDragId(input.activeId);
  const originalLocation = findKanbanCardLocation(input.snapshot, activeCardId);
  const currentLocation = findKanbanCardLocation(input.columns, activeCardId);
  const targetPhase =
    findKanbanPhaseForDragId(input.columns, input.overId) ??
    findKanbanPhaseForDragId(input.snapshot, input.overId);

  if (!originalLocation || !currentLocation || !targetPhase || !input.overId) {
    return {
      type: "noop",
      nextColumns: cloneKanbanColumns(input.snapshot),
    };
  }

  if (originalLocation.phase === targetPhase) {
    const reorderedColumns = reorderKanbanWithinColumn(
      input.columns,
      targetPhase,
      activeCardId,
      input.overId
    );

    if (
      areCardOrdersEqual(
        input.snapshot[targetPhase],
        reorderedColumns[targetPhase]
      )
    ) {
      return {
        type: "noop",
        nextColumns: reorderedColumns,
      };
    }

    return {
      type: "reorder",
      nextColumns: reorderedColumns,
    };
  }

  if (getPendingKanbanPhaseChangeRequest(originalLocation.card)) {
    return {
      type: "blocked",
      nextColumns: cloneKanbanColumns(input.snapshot),
      message:
        "This saving card already has a pending phase change request. Wait for that request to finish before moving it again.",
    };
  }

  if (targetPhase === "CANCELLED") {
    return {
      type: "requires_cancellation_reason",
      nextColumns: cloneKanbanColumns(input.snapshot),
      card: originalLocation.card,
      targetPhase,
    };
  }

  const crossMovedColumns =
    currentLocation.phase === targetPhase
      ? input.columns
      : previewKanbanCrossColumnMove(
          input.columns,
          input.activeId,
          getKanbanColumnId(targetPhase)
        );

  const finalizedColumns = reorderKanbanWithinColumn(
    crossMovedColumns,
    targetPhase,
    activeCardId,
    input.overId
  );

  return {
    type: "move",
    nextColumns: finalizedColumns,
    card: originalLocation.card,
    targetPhase,
  };
}

function replaceKanbanCard(
  columns: KanbanColumns,
  cardId: string,
  updater: (card: SavingCardPortfolio) => SavingCardPortfolio
) {
  const location = findKanbanCardLocation(columns, cardId);

  if (!location) {
    return columns;
  }

  const nextColumns = cloneKanbanColumns(columns);
  nextColumns[location.phase] = nextColumns[location.phase].map((card) =>
    card.id === cardId ? updater(card) : card
  );
  return nextColumns;
}

function applySavedKanbanMove(
  columns: KanbanColumns,
  cardId: string,
  targetPhase: KanbanPhase,
  result: KanbanPhaseChangeRouteResult
) {
  const location = findKanbanCardLocation(columns, cardId);

  if (!location) {
    return columns;
  }

  const displayPhase =
    result.approvalStatus === ApprovalStatus.PENDING
      ? targetPhase
      : result.savingCard?.phase ?? result.requestedPhase;
  const requestSummaries =
    result.approvalStatus === ApprovalStatus.PENDING
      ? [
          {
            id: result.id,
            approvalStatus: result.approvalStatus,
            requestedPhase: result.requestedPhase,
            requestedBy: result.requestedBy,
          },
        ]
      : [];

  const updatedCard = {
    ...location.card,
    phase: displayPhase,
    phaseChangeRequests: requestSummaries,
  };

  if (location.phase === displayPhase) {
    return replaceKanbanCard(columns, cardId, () => updatedCard);
  }

  const nextColumns = cloneKanbanColumns(columns);
  nextColumns[location.phase] = nextColumns[location.phase].filter(
    (card) => card.id !== cardId
  );
  nextColumns[displayPhase] = [...nextColumns[displayPhase], updatedCard];
  return nextColumns;
}

function buildKanbanMoveSuccessMessage(
  cardTitle: string,
  result: KanbanPhaseChangeRouteResult
) {
  if (result.approvalStatus === ApprovalStatus.PENDING) {
    return `${cardTitle} moved to ${phaseLabels[result.requestedPhase]} and is awaiting approval.`;
  }

  return `${cardTitle} moved to ${phaseLabels[result.requestedPhase]}.`;
}

function getKanbanDebugWarning(columns: KanbanColumns) {
  if (!isDevelopment()) {
    return null;
  }

  const allCards = phases.flatMap((phase) => columns[phase]);
  const hasInvalidSavings = allCards.some(
    (card) =>
      typeof card.calculatedSavings !== "number" ||
      !Number.isFinite(card.calculatedSavings)
  );

  return hasInvalidSavings
    ? "Some Kanban saving values were invalid and were normalized locally so the board can still render."
    : null;
}

export function KanbanBoard({
  initialCards,
  readiness,
  loadState,
}: {
  initialCards: SavingCardPortfolio[];
  readiness?: WorkspaceReadiness | null;
  loadState?: KanbanBoardLoadState;
}) {
  const initialColumns = buildKanbanColumns(initialCards);
  const [columns, setColumnsState] = useState(() => initialColumns);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [notice, setNotice] = useState<KanbanNotice>(null);
  const [cancellationDraft, setCancellationDraft] =
    useState<CancellationDraft | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const columnsRef = useRef<KanbanColumns>(initialColumns);
  const dragSnapshotRef = useRef<KanbanColumns | null>(null);
  const lastOverIdRef = useRef<string | null>(null);

  const cardsError = loadState?.cardsError?.trim() || null;
  const readinessError = loadState?.readinessError?.trim() || null;
  const totalCards = phases.reduce((sum, phase) => sum + columns[phase].length, 0);
  const debugWarning = getKanbanDebugWarning(columns);
  const activeCard = activeCardId
    ? findKanbanCardLocation(columns, activeCardId)?.card ??
      (dragSnapshotRef.current
        ? findKanbanCardLocation(dragSnapshotRef.current, activeCardId)?.card ??
          null
        : null)
    : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function setColumns(updater: KanbanColumnsUpdater) {
    setColumnsState((current) => {
      const nextColumns =
        typeof updater === "function"
          ? (updater as (current: KanbanColumns) => KanbanColumns)(current)
          : updater;
      columnsRef.current = nextColumns;
      return nextColumns;
    });
  }

  function showNotice(
    tone: "error" | "success" | "warning",
    message: string
  ) {
    setNotice({ tone, message });
  }

  const collisionDetectionStrategy: CollisionDetection = (args) => {
    let intersections = pointerWithin(args);

    if (!intersections.length) {
      intersections = rectIntersection(args);
    }

    let overId = getFirstCollision(intersections, "id");

    if (overId) {
      const overIdValue = String(overId);
      const overColumnPhase = parseKanbanColumnId(overIdValue);

      if (overColumnPhase) {
        const cardIds = columnsRef.current[overColumnPhase].map((card) =>
          getKanbanCardDragId(card.id)
        );

        if (cardIds.length) {
          const closestCard = closestCenter({
            ...args,
            droppableContainers: args.droppableContainers.filter((container) =>
              cardIds.includes(String(container.id))
            ),
          });
          const closestCardId = getFirstCollision(closestCard, "id");

          if (closestCardId) {
            overId = closestCardId;
          }
        }
      }

      lastOverIdRef.current = String(overId);
      return [{ id: overId }];
    }

    if (lastOverIdRef.current) {
      return [{ id: lastOverIdRef.current }];
    }

    return [];
  };

  async function persistMove(input: {
    snapshot: KanbanColumns;
    card: SavingCardPortfolio;
    targetPhase: KanbanPhase;
    cancellationReason?: string;
  }) {
    setSavingCardId(input.card.id);
    setNotice(null);

    try {
      const response = await fetch("/api/phase-change-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          savingCardId: input.card.id,
          requestedPhase: input.targetPhase,
          cancellationReason: input.cancellationReason,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | {
              error?: string;
            }
          | null;

        setColumns(cloneKanbanColumns(input.snapshot));
        showNotice("error", payload?.error ?? "This move could not be saved.");
        setSavingCardId(null);
        return;
      }

      const result = (await response.json()) as KanbanPhaseChangeRouteResult;

      setColumns((current) =>
        applySavedKanbanMove(current, input.card.id, input.targetPhase, result)
      );
      showNotice(
        "success",
        buildKanbanMoveSuccessMessage(input.card.title, result)
      );
      setSavingCardId(null);
    } catch (error) {
      setColumns(cloneKanbanColumns(input.snapshot));
      showNotice(
        "error",
        error instanceof Error ? error.message : "This move could not be saved."
      );
      setSavingCardId(null);
    }
  }

  function handleMoveOutcome(
    outcome: KanbanMoveOutcome,
    snapshot: KanbanColumns
  ) {
    if (outcome.type === "noop") {
      setColumns(cloneKanbanColumns(outcome.nextColumns));
      return;
    }

    if (outcome.type === "reorder") {
      setColumns(outcome.nextColumns);
      return;
    }

    if (outcome.type === "blocked") {
      setColumns(cloneKanbanColumns(outcome.nextColumns));
      showNotice("warning", outcome.message);
      return;
    }

    if (outcome.type === "requires_cancellation_reason") {
      setColumns(cloneKanbanColumns(outcome.nextColumns));
      setCancellationDraft({
        cardId: outcome.card.id,
        targetPhase: outcome.targetPhase,
      });
      setCancellationReason("");
      showNotice(
        "warning",
        `${outcome.card.title} needs a cancellation reason before it can move to Cancelled.`
      );
      return;
    }

    setColumns(outcome.nextColumns);
    void persistMove({
      snapshot,
      card: outcome.card,
      targetPhase: outcome.targetPhase,
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const cardId = parseKanbanCardDragId(String(event.active.id));
    dragSnapshotRef.current = cloneKanbanColumns(columnsRef.current);
    lastOverIdRef.current = null;
    setActiveCardId(cardId);
    setNotice(null);
  }

  function handleDragOver(event: DragOverEvent) {
    if (!event.over) {
      return;
    }

    const overId = String(event.over.id);
    lastOverIdRef.current = overId;

    setColumns((current) =>
      previewKanbanCrossColumnMove(
        current,
        String(event.active.id),
        overId
      )
    );
  }

  function clearDragState() {
    setActiveCardId(null);
    dragSnapshotRef.current = null;
    lastOverIdRef.current = null;
  }

  function handleDragCancel() {
    if (dragSnapshotRef.current) {
      setColumns(cloneKanbanColumns(dragSnapshotRef.current));
    }

    clearDragState();
  }

  function handleDragEnd(event: DragEndEvent) {
    const snapshot = dragSnapshotRef.current
      ? cloneKanbanColumns(dragSnapshotRef.current)
      : cloneKanbanColumns(columnsRef.current);
    const currentColumns = cloneKanbanColumns(columnsRef.current);
    const overId = event.over?.id ? String(event.over.id) : null;
    const sourcePhase = findKanbanCardLocation(
      snapshot,
      parseKanbanCardDragId(String(event.active.id))
    )?.phase;
    const targetPhase =
      findKanbanPhaseForDragId(currentColumns, overId) ??
      findKanbanPhaseForDragId(snapshot, overId);

    if (isDevelopment()) {
      console.info("[Kanban DnD]", {
        activeId: String(event.active.id),
        overId,
        sourcePhase: sourcePhase ?? null,
        targetPhase: targetPhase ?? null,
      });
    }

    if (!overId || !targetPhase) {
      setColumns(cloneKanbanColumns(snapshot));
      clearDragState();

      if (isDevelopment()) {
        showNotice(
          "warning",
          "Drop target could not be resolved. Try dropping deeper inside the destination column."
        );
      }

      return;
    }

    const outcome = resolveKanbanMoveOutcome({
      snapshot,
      columns: currentColumns,
      activeId: String(event.active.id),
      overId,
    });

    clearDragState();
    handleMoveOutcome(outcome, snapshot);
  }

  function handleFallbackMove(cardId: string, targetPhase: KanbanPhase) {
    const snapshot = cloneKanbanColumns(columnsRef.current);
    const outcome = resolveKanbanMoveOutcome({
      snapshot,
      columns: columnsRef.current,
      activeId: getKanbanCardDragId(cardId),
      overId: getKanbanColumnId(targetPhase),
    });

    handleMoveOutcome(outcome, snapshot);
  }

  if (cardsError && !totalCards) {
    return (
      <div className="space-y-4">
        <StateCard
          title="Kanban board is unavailable"
          description={cardsError}
          action={
            <Link
              href="/kanban"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Refresh board
            </Link>
          }
        />
        {readinessError ? (
          <InlineNotice
            title="Workspace setup status is temporarily unavailable"
            description={readinessError}
          />
        ) : null}
      </div>
    );
  }

  if (!totalCards) {
    return (
      <div className="space-y-4">
        {readinessError ? (
          <InlineNotice
            title="Workspace setup status is temporarily unavailable"
            description={readinessError}
          />
        ) : null}
        <StateCard
          title="No board activity yet"
          description="Create the first saving card to start using the Kanban board."
          action={
            <Link
              href="/saving-cards/new"
              className={buttonVariants({ size: "sm" })}
            >
              Create saving card
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {readinessError ? (
        <InlineNotice
          title="Workspace setup status is temporarily unavailable"
          description={readinessError}
        />
      ) : null}
      {cardsError ? (
        <InlineNotice title="Board data may be stale" description={cardsError} />
      ) : null}
      {debugWarning ? (
        <InlineNotice
          title="Development data warning"
          description={debugWarning}
        />
      ) : null}
      {readiness && !readiness.isWorkspaceReady ? (
        <InlineNotice
          title="Workspace setup is still in progress"
          description="The board is live, but workflow movement will be more reliable as setup and coverage improve."
        />
      ) : null}
      {notice ? (
        <InlineNotice
          title={
            notice.tone === "success"
              ? "Board updated"
              : notice.tone === "warning"
                ? "Move blocked"
                : "Move failed"
          }
          description={notice.message}
          tone={notice.tone}
        />
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-5 xl:grid-cols-5">
          {phases.map((phase) => (
            <KanbanColumn
              key={phase}
              phase={phase}
              cards={columns[phase]}
              savingCardId={savingCardId}
              activeCardId={activeCardId}
              onFallbackMove={handleFallbackMove}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? <KanbanDragPreview card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>

      {cancellationDraft ? (
        <Card>
          <CardHeader>
            <CardTitle>Cancellation reason required</CardTitle>
            <CardDescription>
              {findKanbanCardLocation(columns, cancellationDraft.cardId)?.card
                ?.title ?? "This saving card"}{" "}
              needs a reason before it can move to Cancelled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              placeholder="Explain why this saving card is being cancelled."
              className="min-h-28 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            />
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(savingCardId)}
                onClick={() => {
                  setCancellationDraft(null);
                  setCancellationReason("");
                }}
              >
                Keep card active
              </Button>
              <Button
                type="button"
                disabled={Boolean(savingCardId) || !cancellationReason.trim()}
                onClick={() => {
                  if (!cancellationDraft) {
                    return;
                  }

                  const snapshot = cloneKanbanColumns(columnsRef.current);
                  const outcome = resolveKanbanMoveOutcome({
                    snapshot,
                    columns: columnsRef.current,
                    activeId: getKanbanCardDragId(cancellationDraft.cardId),
                    overId: getKanbanColumnId(cancellationDraft.targetPhase),
                  });

                  if (outcome.type !== "requires_cancellation_reason") {
                    handleMoveOutcome(outcome, snapshot);
                    setCancellationDraft(null);
                    setCancellationReason("");
                    return;
                  }

                  const nextColumns = applyKanbanMove(
                    columnsRef.current,
                    cancellationDraft.cardId,
                    cancellationDraft.targetPhase,
                    columnsRef.current[cancellationDraft.targetPhase].length,
                    {
                      optimistic: true,
                    }
                  );
                  const card = findKanbanCardLocation(
                    snapshot,
                    cancellationDraft.cardId
                  )?.card;

                  if (!card) {
                    setCancellationDraft(null);
                    setCancellationReason("");
                    return;
                  }

                  setColumns(nextColumns);
                  setCancellationDraft(null);
                  setCancellationReason("");
                  void persistMove({
                    snapshot,
                    card,
                    targetPhase: cancellationDraft.targetPhase,
                    cancellationReason: cancellationReason.trim(),
                  });
                }}
              >
                {savingCardId === cancellationDraft.cardId
                  ? "Saving..."
                  : "Move to Cancelled"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function KanbanColumn({
  phase,
  cards,
  savingCardId,
  activeCardId,
  onFallbackMove,
}: {
  phase: KanbanPhase;
  cards: SavingCardPortfolio[];
  savingCardId: string | null;
  activeCardId: string | null;
  onFallbackMove: (cardId: string, targetPhase: KanbanPhase) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: getKanbanColumnId(phase),
    data: {
      type: "column",
      phase,
    },
  });

  const totalSavings = cards.reduce(
    (sum, card) => sum + normalizeSavings(card.calculatedSavings),
    0
  );

  return (
    <div
      ref={setNodeRef}
      data-phase={phase}
      className={cn(
        "min-h-[360px] rounded-3xl border border-[var(--border)] bg-white p-4 transition-colors",
        isOver && "border-[var(--primary)] bg-blue-50"
      )}
    >
      <div className="mb-4 border-b border-[var(--border)] pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{phaseLabels[phase]}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {cards.length} card{cards.length === 1 ? "" : "s"}
            </p>
          </div>
          <Badge tone="slate">{cards.length}</Badge>
        </div>
        <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
          {formatCurrency(totalSavings, "EUR")}
        </p>
      </div>

      <SortableContext
        items={cards.map((card) => getKanbanCardDragId(card.id))}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {cards.length ? (
            cards.map((card) => (
              <SortableKanbanCard
                key={card.id}
                card={card}
                currentPhase={phase}
                isSaving={savingCardId === card.id}
                isActiveDrag={activeCardId === card.id}
                onFallbackMove={onFallbackMove}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted)]/30 px-4 py-10 text-center text-sm text-[var(--muted-foreground)]">
              Drop a card here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableKanbanCard({
  card,
  currentPhase,
  isSaving,
  isActiveDrag,
  onFallbackMove,
}: {
  card: SavingCardPortfolio;
  currentPhase: KanbanPhase;
  isSaving: boolean;
  isActiveDrag: boolean;
  onFallbackMove: (cardId: string, targetPhase: KanbanPhase) => void;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: getKanbanCardDragId(card.id),
    data: {
      type: "card",
      phase: currentPhase,
      cardId: card.id,
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.06)]",
        isDragging && "opacity-40"
      )}
    >
      <KanbanCardBody
        card={card}
        currentPhase={currentPhase}
        isSaving={isSaving}
        isGhost={isActiveDrag || isDragging}
        onFallbackMove={onFallbackMove}
        dragRegionRef={setActivatorNodeRef}
        dragAttributes={attributes}
        dragListeners={listeners}
        dragHandle={
          <div
            className="flex items-start justify-between gap-3"
          >
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                {card.title}
              </p>
              <p className="truncate text-xs text-[var(--muted-foreground)]">
                {card.supplier.name} · {card.material.name}
              </p>
            </div>
            <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)]">
              <GripVertical className="h-4 w-4" />
            </span>
          </div>
        }
      />
    </div>
  );
}

function KanbanDragPreview({ card }: { card: SavingCardPortfolio }) {
  return (
    <div className="w-[280px] rotate-[1deg] rounded-2xl border border-[var(--border)] bg-white shadow-[0_20px_45px_rgba(15,23,42,0.18)]">
      <KanbanCardBody
        card={card}
        currentPhase={getVisibleKanbanPhase(card)}
        isSaving={false}
        isGhost={false}
        onFallbackMove={() => undefined}
        dragHandle={
          <div className="flex items-start justify-between gap-3 px-3 py-2">
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                {card.title}
              </p>
              <p className="truncate text-xs text-[var(--muted-foreground)]">
                {card.supplier.name} · {card.material.name}
              </p>
            </div>
            <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)]">
              <GripVertical className="h-4 w-4" />
            </span>
          </div>
        }
      />
    </div>
  );
}

function KanbanCardBody({
  card,
  currentPhase,
  isSaving,
  isGhost,
  onFallbackMove,
  dragRegionRef,
  dragAttributes,
  dragListeners,
  dragHandle,
}: {
  card: SavingCardPortfolio;
  currentPhase: KanbanPhase;
  isSaving: boolean;
  isGhost: boolean;
  onFallbackMove: (cardId: string, targetPhase: KanbanPhase) => void;
  dragRegionRef?: (element: HTMLElement | null) => void;
  dragAttributes?: Record<string, any>;
  dragListeners?: Record<string, any>;
  dragHandle: ReactNode;
}) {
  const pendingRequest = getPendingKanbanPhaseChangeRequest(card);

  return (
    <div className={cn("p-1", isGhost && "pointer-events-none")}>
      <div
        ref={dragRegionRef}
        className="cursor-grab rounded-xl border border-transparent px-3 py-2 transition hover:border-[var(--border)] hover:bg-[var(--muted)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
        style={{ touchAction: "none" }}
        {...dragAttributes}
        {...dragListeners}
      >
        {dragHandle}

        <div className="space-y-2 pt-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--muted-foreground)]">Savings</span>
            <span className="font-semibold text-[var(--foreground)]">
              {formatCurrency(card.calculatedSavings, "EUR")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--muted-foreground)]">Owner</span>
            <span className="font-medium text-[var(--foreground)]">
              {card.buyer.name}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-3">
          {pendingRequest ? <Badge tone="amber">Pending</Badge> : null}
          {isSaving ? <Badge tone="blue">Saving...</Badge> : null}
        </div>

        {pendingRequest ? (
          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Waiting to move to {phaseLabels[pendingRequest.requestedPhase]}.
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2 px-3 pb-3">
        <select
          key={`${card.id}-${currentPhase}`}
          aria-label={`Move ${card.title} to`}
          defaultValue=""
          disabled={Boolean(pendingRequest) || isSaving}
          className="h-9 flex-1 rounded-lg border border-[var(--input)] bg-white px-3 text-sm text-[var(--foreground)] outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-60"
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            const nextPhase = event.currentTarget.value as KanbanPhase | "";
            event.currentTarget.value = "";

            if (!nextPhase) {
              return;
            }

            onFallbackMove(card.id, nextPhase);
          }}
        >
          <option value="">Move to...</option>
          {buildKanbanMoveOptions(currentPhase).map((phase) => (
            <option key={phase} value={phase}>
              {phaseLabels[phase]}
            </option>
          ))}
        </select>
        <Link
          href={`/saving-cards/${card.id}`}
          onPointerDown={(event) => event.stopPropagation()}
          className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
        >
          Open
        </Link>
      </div>
    </div>
  );
}

function StateCard({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="border-amber-200 bg-amber-50/80">
      <CardHeader>
        <CardTitle className="text-amber-950">{title}</CardTitle>
        <CardDescription className="text-amber-900">
          {description}
        </CardDescription>
      </CardHeader>
      {action ? <CardContent className="pt-0">{action}</CardContent> : null}
    </Card>
  );
}

function InlineNotice({
  title,
  description,
  tone = "warning",
}: {
  title: string;
  description: string;
  tone?: "warning" | "success" | "error";
}) {
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50/80"
      : tone === "error"
        ? "border-rose-200 bg-rose-50/80"
        : "border-amber-200 bg-amber-50/80";
  const titleClass =
    tone === "success"
      ? "text-emerald-950"
      : tone === "error"
        ? "text-rose-950"
        : "text-amber-950";
  const descriptionClass =
    tone === "success"
      ? "text-emerald-900"
      : tone === "error"
        ? "text-rose-900"
        : "text-amber-900";

  return (
    <Card className={className}>
      <CardContent className="space-y-1 py-4">
        <p className={cn("text-sm font-semibold", titleClass)}>{title}</p>
        <p className={cn("text-sm", descriptionClass)}>{description}</p>
      </CardContent>
    </Card>
  );
}
