import Link from "next/link";
import { notFound } from "next/navigation";
import { SavingCardDetailWorkspace } from "@/components/saving-cards/detail-workspace";
import { PhaseBadge } from "@/components/ui/phase-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getSavingCard, getSavingCardDetailReferenceData } from "@/lib/data";
import {
  phaseLabels,
  savingTypeLabels,
  savingsImpactTypeLabels,
} from "@/lib/constants";
import { formatCurrency, formatPlainNumber } from "@/lib/utils/numberFormatter";
import { serializeDecimals, toNumber } from "@/lib/utils/decimal";
import { canLockFinance, hasPermission } from "@/lib/permissions";

export default async function SavingCardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ created?: string | string[] }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const showCreatedSuccess = resolvedSearchParams?.created === "1";

  const card = await getSavingCard(id, user.organizationId);

  if (!card) notFound();

  const referenceData = await getSavingCardDetailReferenceData(user.organizationId);

  const alternativeSupplierLabel =
    card.alternativeSupplier?.name ?? card.alternativeSupplierManualName ?? "Not specified";
  const alternativeMaterialLabel =
    card.alternativeMaterial?.name ?? card.alternativeMaterialManualName ?? "Not specified";
  const canApprove = card.phaseChangeRequests.some(
    (request) =>
      request.approvalStatus === "PENDING" &&
      request.approvals.some(
        (approval) => approval.approverId === user.id && approval.status === "PENDING"
      )
  );
  const canRequestPhaseChange = hasPermission(user.role, "manageSavingCards");

  return (
    <div className="space-y-8">
      <SectionHeading
        title={card.title}
        subtitle={card.description || "This saving card contains the commercial narrative, financial case, evidence, and approval trail for the initiative."}
        action={
          <Link href={`/saving-cards/${card.id}/edit`}>
            <Button variant="outline">Edit Card</Button>
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <PhaseBadge phase={card.phase}>{phaseLabels[card.phase]}</PhaseBadge>
        <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium text-[var(--foreground)]">
          {savingTypeLabels[card.savingType]}
        </span>
        <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium text-[var(--foreground)]">
          {savingsImpactTypeLabels[card.impactType]}
        </span>
        <span className="rounded-full border border-[var(--border)] bg-[var(--muted)]/45 px-3 py-1 text-xs font-medium text-[var(--foreground)]">
          {card.financeLocked ? "Finance locked" : "Finance open"}
        </span>
      </div>

      {showCreatedSuccess ? (
        <Card className="border-[rgba(16,185,129,0.26)] bg-[rgba(16,185,129,0.08)]">
          <CardHeader>
            <CardTitle>First saving card created</CardTitle>
            <CardDescription>
              This workspace now has a real savings initiative with visible
              calculated savings. Create the card first. Then attach evidence
              and request finance validation.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link href={`/saving-cards/${card.id}#evidence`}>
              <Button variant="outline">Attach evidence</Button>
            </Link>
            {canRequestPhaseChange ? (
              <Link href={`/saving-cards/${card.id}#workflow`}>
                <Button variant="outline">Request validation</Button>
              </Link>
            ) : null}
            <Link href="/dashboard">
              <Button>Open dashboard</Button>
            </Link>
            <Link href="/saving-cards/new">
              <Button variant="ghost">Create another card</Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="space-y-3 border-b border-[var(--border)] bg-[var(--surface-elevated)]/75">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">
              Executive Case
            </p>
            <CardTitle className="text-[1.75rem] tracking-[-0.03em]">Financial Case</CardTitle>
            <CardDescription className="max-w-2xl text-[14px] leading-6">
              Baseline {formatCurrency(card.baselinePrice, card.currency)} to new price{" "}
              {formatCurrency(card.newPrice, card.currency)} across annual volume of{" "}
              {formatPlainNumber(card.annualVolume)}.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TopMetric label="Indicative Savings" value={formatCurrency(Math.round(toNumber(card.calculatedSavings)), "USD")} emphasis />
            <TopMetric label="Savings (USD)" value={formatCurrency(Math.round(toNumber(card.calculatedSavingsUSD)), "USD")} />
            <TopMetric label="Baseline Price" value={formatCurrency(card.baselinePrice, card.currency)} />
            <TopMetric label="Annual Volume" value={formatPlainNumber(card.annualVolume)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)]/55 p-5">
              <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">
                Commercial narrative
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">
                {card.description || "No narrative has been recorded for this initiative yet."}
              </p>
            </div>

            <div className="space-y-3">
              <InfoStrip label="Baseline Supplier" value={card.supplier.name} />
              <InfoStrip label="Baseline Material" value={card.material.name} />
              <InfoStrip label="Alternative Supplier" value={alternativeSupplierLabel} />
              <InfoStrip label="Alternative Material" value={alternativeMaterialLabel} />
              <InfoStrip label="Impact Window" value={`${formatDate(card.impactStartDate)} - ${formatDate(card.impactEndDate)}`} />
              <InfoStrip label="Buyer / Category" value={`${card.buyer.name} · ${card.category.name}`} />
            </div>
          </div>
        </CardContent>
      </Card>

      <SavingCardDetailWorkspace
        card={serializeDecimals(card)}
        referenceData={serializeDecimals(referenceData)}
        canApprove={canApprove}
        canLock={canLockFinance(user.role)}
        currentUserId={user.id}
        canRequestPhaseChange={canRequestPhaseChange}
      />
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(date));
}

function InfoStrip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white px-3 py-3">
      <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--foreground)]">{value}</span>
    </div>
  );
}

function TopMetric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${emphasis ? "border-slate-200 bg-slate-50" : "border-[var(--border)] bg-white"}`}>
      <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">{label}</p>
      <p className={`mt-2 ${emphasis ? "text-[1.35rem]" : "text-base"} font-semibold tracking-[-0.03em]`}>{value}</p>
    </div>
  );
}
