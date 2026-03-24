"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import { LoadSampleDataButton } from "@/components/onboarding/load-sample-data-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { getValueBadgeTone } from "@/lib/calculations";
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
      <div className="space-y-6">
        <Card className="border-0 bg-[linear-gradient(135deg,#113b61_0%,#194f7a_58%,#1b7f87_100%)] text-white">
          <CardContent className="grid gap-6 p-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-cyan-100">
                Portfolio Launch
              </div>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">
                  No live saving cards yet.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-cyan-50/85">
                  This portfolio becomes the shared working view once the first cards are live. Start with one structured card, then use this page to track phase progression, ownership, supplier exposure, and finance-lock status.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/saving-cards/new" className={buttonVariants({ size: "sm" })}>
                  Create first saving card
                </Link>
                <LoadSampleDataButton
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  Load sample data
                </LoadSampleDataButton>
                <Link
                  href="/admin"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "border-white/20 bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  Review setup
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <PortfolioLaunchMetric
                label="Setup Completeness"
                value={`${readiness?.coverage.overallPercent ?? 0}%`}
                detail="Combined master-data and workflow readiness."
              />
              <PortfolioLaunchMetric
                label="Master Data"
                value={`${configuredCollections}/${readiness?.masterData.length ?? 6}`}
                detail="Configured collections ready for card creation."
              />
              <PortfolioLaunchMetric
                label="Workflow Coverage"
                value={`${workflowCoverageReady}/${readiness?.workflowCoverage.length ?? 3}`}
                detail="Approval roles currently assigned."
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Next Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {nextActions.map((item) => (
                <div key={item} className="rounded-xl bg-[var(--muted)] px-4 py-3 text-sm">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What This Page Tracks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <PortfolioPromise
                title="Live portfolio register"
                description="Every saving card will appear here with phase, owner, supplier, timing, and finance-lock status."
              />
              <PortfolioPromise
                title="Working search and filters"
                description="Teams can narrow the portfolio by search or phase once multiple initiatives are active."
              />
              <PortfolioPromise
                title="Operational oversight"
                description="This page becomes the fastest way to review open initiatives before drilling into the full workspace."
              />
            </CardContent>
          </Card>
        </div>
      </div>
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
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
          <Table className="min-w-[980px] bg-white">
            <TableHead>
              <tr>
                <TableHeaderCell>Title</TableHeaderCell>
                <TableHeaderCell>Phase</TableHeaderCell>
                <TableHeaderCell>Category</TableHeaderCell>
                <TableHeaderCell>Buyer</TableHeaderCell>
                <TableHeaderCell>Supplier</TableHeaderCell>
                <TableHeaderCell className="text-right">Savings</TableHeaderCell>
                <TableHeaderCell>Timing</TableHeaderCell>
                <TableHeaderCell>Lock</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {filteredCards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell>
                    <Link href={`/saving-cards/${card.id}`} className="font-semibold text-[var(--foreground)] hover:text-[var(--primary)] hover:underline">
                      {card.title}
                    </Link>
                    <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">{card.savingType}</p>
                  </TableCell>
                  <TableCell>
                    <Badge tone={getValueBadgeTone(card.phase)}>{phaseLabels[card.phase]}</Badge>
                  </TableCell>
                  <TableCell>{card.category.name}</TableCell>
                  <TableCell>{card.buyer.name}</TableCell>
                  <TableCell>{card.supplier.name}</TableCell>
                  <TableCell className="text-right">
                    <p className="font-semibold">{formatCurrency(Math.round(card.calculatedSavings), "EUR")}</p>
                    <p className="text-[12px] text-[var(--muted-foreground)]">{card.currency} basis</p>
                  </TableCell>
                  <TableCell>
                    <p>{formatDate(card.impactStartDate)}</p>
                    <p className="text-[12px] text-[var(--muted-foreground)]">to {formatDate(card.impactEndDate)}</p>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        card.financeLocked
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                          : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                      }
                    >
                      {card.financeLocked ? "Locked" : "Open"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</p>
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
        <p className="mt-2 text-[12px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{label}</p>
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
