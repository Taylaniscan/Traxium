"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import { PhaseBadge, PhaseDot } from "@/components/ui/phase-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { phaseLabels, phases } from "@/lib/constants";
import type { SavingCardPortfolio, WorkspaceReadiness } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/numberFormatter";

export function SavingCardTable({
  cards,
  readiness,
}: {
  cards: SavingCardPortfolio[];
  readiness?: WorkspaceReadiness | null;
}) {
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");

  const filteredCards = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return cards.filter((card) => {
      if (phaseFilter && card.phase !== phaseFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        card.title,
        card.savingType,
        card.category.name,
        card.buyer.name,
        card.supplier.name,
        phaseLabels[card.phase],
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [cards, phaseFilter, search]);

  const activeFilters = Boolean(search.trim() || phaseFilter);
  const totalSavings = filteredCards.reduce((sum, card) => sum + card.calculatedSavings, 0);
  const lockedCount = filteredCards.filter((card) => card.financeLocked).length;
  const realisedCount = filteredCards.filter((card) => card.phase === "REALISED" || card.phase === "ACHIEVED").length;
  const totalLockedCount = cards.filter((card) => card.financeLocked).length;
  const configuredCollections = readiness?.masterData.filter((item) => item.ready).length ?? 0;
  const workflowCoverageReady = readiness?.workflowCoverage.filter((item) => item.ready).length ?? 0;
  const showRampUpState =
    cards.length > 0 && (cards.length < 3 || (readiness ? !readiness.isWorkspaceReady : false));
  const nextActions = buildPortfolioNextActions(readiness, cards.length);

  if (!cards.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          <div className="text-4xl" aria-hidden="true">
            📋
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              No saving cards yet
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Start by adding your first savings initiative.
            </p>
          </div>
          <Link href="/saving-cards/new" className={buttonVariants({ size: "sm" })}>
            Add First Initiative
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {showRampUpState ? (
        <PortfolioRampUpCard
          readiness={readiness}
          cardCount={cards.length}
          lockedCount={totalLockedCount}
          configuredCollections={configuredCollections}
          workflowCoverageReady={workflowCoverageReady}
          nextActions={nextActions}
        />
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Portfolio Controls</CardTitle>
            <p className="mt-1 text-[14px] text-[var(--muted-foreground)]">
              Search by title, buyer, category, supplier, or saving type, and filter by workflow phase across the live workspace register.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/60 p-2">
            <Filter className="h-4 w-4 text-[var(--muted-foreground)]" />
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, buyer, supplier, category, or saving type"
              className="pl-10"
            />
          </div>
          <Select value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)}>
            <option value="">All phases</option>
            {phases.map((phase) => (
              <option key={phase} value={phase}>
                {phaseLabels[phase]}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearch("");
              setPhaseFilter("");
            }}
            disabled={!activeFilters}
          >
            Clear filters
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryTile label="Portfolio Savings" value={formatCurrency(Math.round(totalSavings), "EUR")} />
        <SummaryTile label="Finance Locked Cards" value={String(lockedCount)} />
        <SummaryTile label="Realised or Achieved" value={String(realisedCount)} />
      </div>

      {!filteredCards.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No saving cards match the current view</CardTitle>
            <p className="mt-1 text-[14px] text-[var(--muted-foreground)]">
              The portfolio still has {cards.length} saving card{cards.length === 1 ? "" : "s"}, but none match the active search or phase filter.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-[var(--muted-foreground)]">
              Clear the filters to return to the full register, or create a new card if you are looking for a fresh initiative.
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setPhaseFilter("");
                }}
              >
                Clear filters
              </Button>
              <Link href="/saving-cards/new" className={buttonVariants({ size: "sm" })}>
                Create Saving Card
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-end justify-between gap-4">
          <div>
            <CardTitle>Saving Cards</CardTitle>
            <p className="mt-1 text-[14px] text-[var(--muted-foreground)]">
              Operational register of all initiatives, with phase, owner, supplier, and finance controls.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredCards.map((card) => (
              <Link
                key={card.id}
                href={`/saving-cards/${card.id}`}
                className="flex flex-col gap-4 rounded-[10px] border border-[rgba(99,102,241,0.1)] bg-white px-4 py-4 transition-shadow hover:shadow-[0_2px_8px_rgba(79,70,229,0.12)] lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <PhaseDot phase={card.phase} className="h-2 w-2" />
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {card.title}
                    </p>
                    {card.financeLocked ? (
                      <span className="text-sm" aria-label="Finance locked">
                        🔒
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-[13px] text-[var(--muted-foreground)]">
                    {card.category.name} · {card.supplier.name} · {card.buyer.name}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                    {card.savingType} · {formatDate(card.impactStartDate)} to{" "}
                    {formatDate(card.impactEndDate)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 lg:flex-col lg:items-end">
                  <div className="text-left lg:text-right">
                    <p className="text-base font-semibold text-[var(--foreground)]">
                      {formatCurrency(Math.round(card.calculatedSavings), "EUR")}
                    </p>
                    <p className="text-[12px] text-[var(--muted-foreground)]">
                      {card.currency} basis
                    </p>
                  </div>
                  <PhaseBadge phase={card.phase}>{phaseLabels[card.phase]}</PhaseBadge>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PortfolioLaunchMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white/80 p-4 text-[var(--foreground)]">
      <p className="text-[11px] text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

function PortfolioPromise({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/40 p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
    </div>
  );
}

function PortfolioRampUpCard({
  readiness,
  cardCount,
  lockedCount,
  configuredCollections,
  workflowCoverageReady,
  nextActions,
}: {
  readiness?: WorkspaceReadiness | null;
  cardCount: number;
  lockedCount: number;
  configuredCollections: number;
  workflowCoverageReady: number;
  nextActions: string[];
}) {
  return (
    <Card className="border-dashed">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>
            {readiness?.isWorkspaceReady
              ? "Portfolio is live and still ramping up"
              : "Portfolio is live, but setup is still in progress"}
          </CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">
            {readiness?.isWorkspaceReady
              ? `You currently have ${cardCount} saving card${cardCount === 1 ? "" : "s"} live. Portfolio controls and search are active, and the view will become more representative as more initiatives are added.`
              : `You already have ${cardCount} saving card${cardCount === 1 ? "" : "s"} live, but some shared setup still needs attention to keep the register standardized and workflow-ready.`}
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="grid gap-3 md:grid-cols-4">
          <PortfolioLaunchMetric label="Live Cards" value={String(cardCount)} detail="Cards currently in the workspace" />
          <PortfolioLaunchMetric label="Locked Cards" value={String(lockedCount)} detail="Cards currently under finance lock" />
          <PortfolioLaunchMetric
            label="Master Data"
            value={`${configuredCollections}/${readiness?.masterData.length ?? 6}`}
            detail="Configured collections"
          />
          <PortfolioLaunchMetric
            label="Workflow Coverage"
            value={`${workflowCoverageReady}/${readiness?.workflowCoverage.length ?? 3}`}
            detail="Assigned approval roles"
          />
        </div>
        <div className="space-y-2">
          {nextActions.slice(0, 3).map((item) => (
            <div key={item} className="rounded-xl bg-[var(--muted)] px-4 py-3 text-sm">
              {item}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-white">
      <CardContent className="p-5">
        <p className="text-[1.7rem] font-semibold tracking-[-0.03em]">{value}</p>
        <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">{label}</p>
      </CardContent>
    </Card>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(date));
}

function buildPortfolioNextActions(readiness: WorkspaceReadiness | null | undefined, cardCount: number) {
  const actions: string[] = [];

  if (!cardCount) {
    actions.push("Create the first saving card to establish the live sourcing register.");
  }

  readiness?.missingCoreSetup.forEach((item) => {
    actions.push(`Add ${item} in Settings so new cards use shared workspace master data.`);
  });

  readiness?.missingWorkflowCoverage.forEach((item) => {
    actions.push(`Assign at least one ${item} user so approval routing is ready when cards advance phases.`);
  });

  if (!actions.length) {
    actions.push("Create and progress saving cards so the portfolio becomes the shared operating view for procurement and finance.");
  }

  return actions.slice(0, 4);
}
