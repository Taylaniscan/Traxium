import Link from "next/link";
import { notFound } from "next/navigation";
import { SavingCardDetailWorkspace } from "@/components/saving-cards/detail-workspace";
import { PhaseBadge } from "@/components/ui/phase-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getReferenceData, getSavingCard } from "@/lib/data";
import { phaseLabels } from "@/lib/constants";
import { formatCurrency, formatPlainNumber } from "@/lib/utils/numberFormatter";
import { canLockFinance, hasPermission } from "@/lib/permissions";

export default async function SavingCardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const [card, referenceData] = await Promise.all([
    getSavingCard(id, user.organizationId),
    getReferenceData(user.organizationId),
  ]);

  if (!card) notFound();

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <SectionHeading title={card.title} />
          <div className="flex flex-wrap gap-2">
            <PhaseBadge phase={card.phase}>{phaseLabels[card.phase]}</PhaseBadge>
            <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium text-[var(--foreground)]">
              {card.savingType}
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--muted)]/45 px-3 py-1 text-xs font-medium text-[var(--foreground)]">
              {card.financeLocked ? "Finance locked" : "Finance open"}
            </span>
          </div>
          <p className="max-w-3xl text-[15px] leading-7 text-[var(--muted-foreground)]">
            {card.description}
          </p>
        </div>
        <Link href={`/saving-cards/${card.id}/edit`}>
          <Button variant="outline">Edit Card</Button>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_340px]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-3 border-b bg-[linear-gradient(180deg,rgba(241,245,249,0.75),#ffffff)]">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">
                Business Overview
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
              <TopMetric label="Indicative Savings" value={formatCurrency(Math.round(card.calculatedSavings), "EUR")} emphasis />
              <TopMetric label="Baseline Price" value={formatCurrency(card.baselinePrice, card.currency)} />
              <TopMetric label="New Price" value={formatCurrency(card.newPrice, card.currency)} />
              <TopMetric label="Annual Volume" value={formatPlainNumber(card.annualVolume)} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <DetailGroup title="Commercial context">
                <InfoStrip label="Baseline Supplier" value={card.supplier.name} />
                <InfoStrip label="Baseline Material" value={card.material.name} />
                <InfoStrip label="Alternative Supplier" value={alternativeSupplierLabel} />
                <InfoStrip label="Alternative Material" value={alternativeMaterialLabel} />
              </DetailGroup>
              <DetailGroup title="Operating context">
                <InfoStrip label="Impact Window" value={`${formatDate(card.impactStartDate)} - ${formatDate(card.impactEndDate)}`} />
                <InfoStrip label="Finance Lock" value={card.financeLocked ? "Locked" : "Open"} />
                <InfoStrip label="FX Rate" value={card.fxRate.toString()} />
                <InfoStrip label="Plant" value={card.plant.name} />
              </DetailGroup>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Record Snapshot</CardTitle>
            <CardDescription>Ownership, operating context, and readiness signals kept separate from workflow review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Metric label="Buyer" value={card.buyer.name} />
            <Metric label="Category" value={card.category.name} />
            <Metric label="Business Unit" value={card.businessUnit.name} />
            <Metric label="Current Phase" value={phaseLabels[card.phase]} />
            <Metric label="Saving Driver" value={card.savingDriver ?? "Not set"} />
            <Metric label="Implementation Complexity" value={card.implementationComplexity ?? "Not set"} />
            <Metric label="Qualification Status" value={card.qualificationStatus ?? "Not set"} />
          </CardContent>
        </Card>
      </div>

      <SavingCardDetailWorkspace
        card={card}
        referenceData={referenceData}
        canApprove={canApprove}
        canLock={canLockFinance(user.role)}
        currentUserId={user.id}
        canRequestPhaseChange={canRequestPhaseChange}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(date));
}

function HighlightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
      <p className="text-xs text-cyan-100/80">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
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

function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-3xl border border-[var(--border)] bg-[var(--muted)]/18 p-5">
      <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
