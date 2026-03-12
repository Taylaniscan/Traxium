import Link from "next/link";
import { notFound } from "next/navigation";
import { SavingCardDetailWorkspace } from "@/components/saving-cards/detail-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { getValueBadgeTone } from "@/lib/calculations";
import { requireUser } from "@/lib/auth";
import { getReferenceData, getSavingCard } from "@/lib/data";
import { phaseLabels, roleLabels } from "@/lib/constants";
import { formatCurrency, formatPlainNumber } from "@/lib/utils/numberFormatter";
import { canApprovePhase, canLockFinance } from "@/lib/permissions";

export default async function SavingCardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [card, user, referenceData] = await Promise.all([getSavingCard(id), requireUser(), getReferenceData()]);

  if (!card) notFound();

  const alternativeSupplierLabel = card.alternativeSupplier?.name ?? card.alternativeSupplierManualName ?? "Not specified";
  const alternativeMaterialLabel = card.alternativeMaterial?.name ?? card.alternativeMaterialManualName ?? "Not specified";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <SectionHeading title={card.title} />
        <Link href={`/saving-cards/${card.id}/edit`}>
          <Button variant="outline">Edit Card</Button>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden border-0 bg-[linear-gradient(135deg,#113b61_0%,#194f7a_58%,#1b7f87_100%)] text-white">
          <CardContent className="grid gap-6 p-8 md:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={getValueBadgeTone(card.phase)} className="bg-white/15 text-white">
                  {phaseLabels[card.phase]}
                </Badge>
                <span className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-wide text-cyan-100">
                  {card.savingType}
                </span>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-100/80">Financial Case</p>
                <h3 className="mt-2 text-3xl font-semibold tracking-tight">
                  {formatCurrency(Math.round(card.calculatedSavings), "EUR")} validated savings potential
                </h3>
                <p className="mt-2 max-w-xl text-sm text-cyan-50/80">
                  Baseline {formatCurrency(card.baselinePrice, card.currency)} to new price {formatCurrency(card.newPrice, card.currency)} across annual volume of{" "}
                  {formatPlainNumber(card.annualVolume)}.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <HighlightMetric label="Buyer" value={card.buyer.name} />
                <HighlightMetric label="Category" value={card.category.name} />
                <HighlightMetric label="Business Unit" value={card.businessUnit.name} />
              </div>
            </div>
            <div className="space-y-3 rounded-[28px] border border-white/10 bg-white/10 p-5">
              <InfoStrip label="Finance Lock" value={card.financeLocked ? "Locked" : "Open"} />
              <InfoStrip label="Impact Window" value={`${formatDate(card.impactStartDate)} - ${formatDate(card.impactEndDate)}`} />
              <InfoStrip label="Baseline Supplier" value={card.supplier.name} />
              <InfoStrip label="Alternative Supplier" value={alternativeSupplierLabel} />
              <InfoStrip label="Plant" value={card.plant.name} />
              <InfoStrip label="FX Rate" value={card.fxRate.toString()} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Validation Snapshot</CardTitle>
            <CardDescription>Current card owner, finance-lock status, and active sourcing basis.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Metric label="Buyer" value={`${card.buyer.name} (${roleLabels[card.buyer.role]})`} />
            <Metric label="Finance Lock" value={card.financeLocked ? "Locked" : "Open"} />
            <Metric label="Baseline Supplier" value={card.supplier.name} />
            <Metric label="Baseline Material" value={card.material.name} />
            <Metric label="Alternative Supplier" value={alternativeSupplierLabel} />
            <Metric label="Alternative Material" value={alternativeMaterialLabel} />
            <Metric label="Saving Driver" value={card.savingDriver ?? "Not set"} />
            <Metric label="Implementation Complexity" value={card.implementationComplexity ?? "Not set"} />
            <Metric label="Qualification Status" value={card.qualificationStatus ?? "Not set"} />
          </CardContent>
        </Card>
      </div>

      <SavingCardDetailWorkspace
        card={card}
        referenceData={referenceData}
        canApprove={canApprovePhase(user.role, card.phase)}
        canLock={canLockFinance(user.role)}
        currentUserId={user.id}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--muted)] p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
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
      <p className="text-xs uppercase tracking-wide text-cyan-100/80">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoStrip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-3 py-3">
      <span className="text-sm text-cyan-100/80">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}
