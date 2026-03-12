"use client";

import { CSS } from "@dnd-kit/utilities";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { getValueBadgeTone } from "@/lib/calculations";
import { implementationComplexities, phaseLabels, qualificationStatuses, roleLabels, savingDrivers, phases } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils/numberFormatter";
import { requiredRolesForPhase } from "@/lib/permissions";
import type { SavingCardWithRelations } from "@/lib/types";

type MoveRequest = {
  card: SavingCardWithRelations;
  targetPhase: (typeof phases)[number];
};

export function KanbanBoard({ initialCards }: { initialCards: SavingCardWithRelations[] }) {
  const [cards, setCards] = useState(initialCards);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [moveRequest, setMoveRequest] = useState<MoveRequest | null>(null);
  const [comment, setComment] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState({
    savingDriver: "",
    implementationComplexity: "",
    qualificationStatus: ""
  });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    setMounted(true);
  }, []);

  const grouped = useMemo(
    () =>
      phases.reduce<Record<string, SavingCardWithRelations[]>>((acc, phase) => {
        acc[phase] = cards.filter((card) => {
          if (card.phase !== phase) return false;
          if (filters.savingDriver && card.savingDriver !== filters.savingDriver) return false;
          if (filters.implementationComplexity && card.implementationComplexity !== filters.implementationComplexity) return false;
          if (filters.qualificationStatus && card.qualificationStatus !== filters.qualificationStatus) return false;
          return true;
        });
        return acc;
      }, {}),
    [cards, filters]
  );

  const activeCard = activeId ? cards.find((item) => item.id === activeId) ?? null : null;

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const cardId = String(event.active.id);
    const targetPhase = event.over?.id ? String(event.over.id) : null;
    if (!targetPhase || !phases.includes(targetPhase as (typeof phases)[number])) return;

    const card = cards.find((item) => item.id === cardId);
    if (!card || card.phase === targetPhase) return;

    setError(null);
    setComment("");
    setCancellationReason("");
    setMoveRequest({ card, targetPhase: targetPhase as (typeof phases)[number] });
  }

  async function submitPhaseChangeRequest() {
    if (!moveRequest) return;
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/phase-change-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        savingCardId: moveRequest.card.id,
        requestedPhase: moveRequest.targetPhase,
        comment,
        cancellationReason
      })
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error ?? "Unable to request approval.");
      setSubmitting(false);
      return;
    }

    const request = await response.json();
    setCards((current) =>
      current.map((card) =>
        card.id === moveRequest.card.id
          ? { ...card, phaseChangeRequests: [request, ...card.phaseChangeRequests.filter((item) => item.id !== request.id)] }
          : card
      )
    );
    setSubmitting(false);
    setMoveRequest(null);
    setComment("");
    setCancellationReason("");
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Kanban Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Select value={filters.savingDriver} onChange={(event) => setFilters((current) => ({ ...current, savingDriver: event.target.value }))}>
            <option value="">All saving drivers</option>
            {savingDrivers.map((driver) => (
              <option key={driver} value={driver}>
                {driver}
              </option>
            ))}
          </Select>
          <Select
            value={filters.implementationComplexity}
            onChange={(event) => setFilters((current) => ({ ...current, implementationComplexity: event.target.value }))}
          >
            <option value="">All complexities</option>
            {implementationComplexities.map((complexity) => (
              <option key={complexity} value={complexity}>
                {complexity}
              </option>
            ))}
          </Select>
          <Select
            value={filters.qualificationStatus}
            onChange={(event) => setFilters((current) => ({ ...current, qualificationStatus: event.target.value }))}
          >
            <option value="">All qualification statuses</option>
            {qualificationStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {!mounted ? (
        <div className="grid gap-5 xl:grid-cols-5">
          {phases.map((phase) => (
            <KanbanColumn key={phase} phase={phase} cards={grouped[phase]} staticMode />
          ))}
        </div>
      ) : (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(event) => setActiveId(String(event.active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={onDragEnd}
      >
        <div className="grid gap-5 xl:grid-cols-5">
          {phases.map((phase) => (
            <KanbanColumn key={phase} phase={phase} cards={grouped[phase]} />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? <KanbanCard card={activeCard} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
      )}

      {moveRequest ? (
        <PhaseChangeModal
          moveRequest={moveRequest}
          comment={comment}
          cancellationReason={cancellationReason}
          submitting={submitting}
          onCommentChange={setComment}
          onCancellationReasonChange={setCancellationReason}
          onClose={() => {
            if (submitting) return;
            setMoveRequest(null);
            setComment("");
            setCancellationReason("");
            setError(null);
          }}
          onSubmit={submitPhaseChangeRequest}
        />
      ) : null}
    </div>
  );
}

function KanbanColumn({
  phase,
  cards,
  staticMode = false
}: {
  phase: (typeof phases)[number];
  cards: SavingCardWithRelations[];
  staticMode?: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: phase });

  return (
    <div
      ref={staticMode ? undefined : setNodeRef}
      className={`min-h-[360px] rounded-[26px] border border-[var(--border)] p-3 transition ${
        !staticMode && isOver ? "border-[var(--primary)] bg-blue-50 shadow-inner" : "bg-white shadow-[0_10px_24px_rgba(17,24,39,0.05)]"
      }`}
    >
      <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div>
          <p className="text-[14px] font-semibold">{phaseLabels[phase]}</p>
          <p className="text-[12px] text-[var(--muted-foreground)]">{cards.length} cards</p>
          <p className="mt-1 text-[13px] font-semibold text-[var(--foreground)]">
            {formatCurrency(cards.reduce((sum, card) => sum + card.calculatedSavings, 0), "EUR")}
          </p>
        </div>
        <Badge tone={getValueBadgeTone(phase)}>{cards.length}</Badge>
      </div>
      <div className="space-y-3">
        {cards.map((card) => (
          <KanbanCard key={card.id} card={card} staticMode={staticMode} />
        ))}
      </div>
    </div>
  );
}

function KanbanCard({
  card,
  isOverlay = false,
  staticMode = false
}: {
  card: SavingCardWithRelations;
  isOverlay?: boolean;
  staticMode?: boolean;
}) {
  if (isOverlay) {
    return <KanbanCardShell card={card} className="rotate-1 shadow-2xl" />;
  }

  if (staticMode) {
    return (
      <div className="transition-shadow">
        <Card>
          <KanbanCardShell card={card} />
        </Card>
      </div>
    );
  }

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id, data: { type: "card" } });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1
      }}
      className="cursor-grab transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(17,24,39,0.12)] active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <Card className="overflow-hidden">
        <KanbanCardShell card={card} />
      </Card>
    </div>
  );
}

function KanbanCardShell({ card, className }: { card: SavingCardWithRelations; className?: string }) {
  const pendingRequest = card.phaseChangeRequests.find((item) => item.approvalStatus === "PENDING");
  const rejectedRequest = card.phaseChangeRequests.find((item) => item.approvalStatus === "REJECTED");
  const tooltip = buildTooltip(card);

  return (
    <div className={className} title={tooltip}>
      <CardHeader className="border-b-0 p-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <CardTitle className="text-[16px] leading-6">{card.title}</CardTitle>
            <p className="text-[13px] leading-5 text-[var(--muted-foreground)]">{describeScenario(card)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {pendingRequest ? <Badge tone="amber">Approval Pending</Badge> : null}
            {!pendingRequest && rejectedRequest ? <Badge tone="rose">Rejected</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-1">
        <div className="rounded-2xl bg-[var(--muted)]/55 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">Saving Value</p>
          <p className="mt-1 text-[1.2rem] font-semibold tracking-[-0.02em]">{formatCurrency(Math.round(card.calculatedSavings), "EUR")}</p>
        </div>
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-[var(--muted-foreground)]">Owner</span>
          <span className="font-medium text-[var(--foreground)]">{card.buyer.name}</span>
        </div>
        {pendingRequest ? (
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Requested: {phaseLabels[pendingRequest.requestedPhase]} by {pendingRequest.requestedBy.name}
          </div>
        ) : null}
        {!pendingRequest && rejectedRequest ? (
          <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-900">
            Last request to {phaseLabels[rejectedRequest.requestedPhase]} was rejected.
          </div>
        ) : null}
        <Link href={`/saving-cards/${card.id}`} className="inline-flex h-8 items-center rounded-xl px-3 text-xs font-medium text-[var(--accent)] hover:bg-[var(--muted)]">
          Open
        </Link>
      </CardContent>
    </div>
  );
}

function PhaseChangeModal({
  moveRequest,
  comment,
  cancellationReason,
  submitting,
  onCommentChange,
  onCancellationReasonChange,
  onClose,
  onSubmit
}: {
  moveRequest: MoveRequest;
  comment: string;
  cancellationReason: string;
  submitting: boolean;
  onCommentChange: (value: string) => void;
  onCancellationReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const roles = requiredRolesForPhase(moveRequest.targetPhase);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-2xl rounded-[28px] border bg-white shadow-2xl">
        <div className="border-b p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--primary)]">Phase Change Approval</p>
          <h3 className="mt-2 text-2xl font-semibold">Move Saving Card to {phaseLabels[moveRequest.targetPhase]} Phase?</h3>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            The card remains in {phaseLabels[moveRequest.card.phase]} until all required approvals are completed.
          </p>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-3">
            <InfoBlock label="Current Phase" value={phaseLabels[moveRequest.card.phase]} />
            <InfoBlock label="Requested Phase" value={phaseLabels[moveRequest.targetPhase]} />
            <InfoBlock label="Card" value={moveRequest.card.title} />
            <div className="rounded-2xl bg-[var(--muted)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Required Approvals</p>
              <div className="mt-2 space-y-2">
                {roles.length ? roles.map((role) => <p key={role} className="text-sm font-semibold">{roleLabels[role]}</p>) : <p className="text-sm font-semibold">No approvals required</p>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Comments</span>
              <textarea
                value={comment}
                onChange={(event) => onCommentChange(event.target.value)}
                className="min-h-28 w-full rounded-2xl border px-4 py-3 text-sm outline-none ring-0"
                placeholder="Explain why the card should move to the requested phase."
              />
            </label>

            {moveRequest.targetPhase === "CANCELLED" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Cancellation Reason</span>
                <textarea
                  value={cancellationReason}
                  onChange={(event) => onCancellationReasonChange(event.target.value)}
                  className="min-h-24 w-full rounded-2xl border px-4 py-3 text-sm outline-none ring-0"
                  placeholder="Cancellation reason is required."
                />
              </label>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Close
              </Button>
              <Button onClick={onSubmit} disabled={submitting || (moveRequest.targetPhase === "CANCELLED" && !cancellationReason.trim())}>
                {submitting ? "Submitting..." : "Request Approval"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--muted)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function describeScenario(card: SavingCardWithRelations) {
  const alternativeSupplier = card.alternativeSupplier?.name ?? card.alternativeSupplierManualName;
  const alternativeMaterial = card.alternativeMaterial?.name ?? card.alternativeMaterialManualName;

  if (alternativeSupplier && alternativeMaterial) {
    return `${card.supplier.name} -> ${alternativeSupplier} · ${card.material.name} -> ${alternativeMaterial}`;
  }

  if (alternativeSupplier) {
    return `${card.supplier.name} -> ${alternativeSupplier}`;
  }

  if (alternativeMaterial) {
    return `${card.material.name} -> ${alternativeMaterial}`;
  }

  return `${card.supplier.name} · ${card.material.name}`;
}

function buildTooltip(card: SavingCardWithRelations) {
  const parts = [
    `Driver: ${card.savingDriver ?? "Not set"}`,
    `Complexity: ${card.implementationComplexity ?? "Not set"}`,
    `Qualification Status: ${card.qualificationStatus ?? "Not set"}`
  ];

  return parts.join("\n");
}
