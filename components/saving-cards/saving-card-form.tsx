"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { CreatableMasterDataField, type CreatableValue } from "@/components/saving-cards/creatable-master-data-field";
import { EvidenceUploader, type UploadedEvidenceFile } from "@/components/saving-cards/evidence-uploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { calculateSavings } from "@/lib/calculations";
import {
  currencies,
  frequencies,
  implementationComplexities,
  phaseLabels,
  phases,
  qualificationStatuses,
  roleLabels,
  savingDrivers
} from "@/lib/constants";
import { formatCurrency } from "@/lib/utils/numberFormatter";
import type { SavingCardWithRelations } from "@/lib/types";

type ReferenceData = Awaited<ReturnType<typeof import("@/lib/data").getReferenceData>>;

type Props = {
  mode: "create" | "edit";
  referenceData: ReferenceData;
  card?: SavingCardWithRelations | null;
};

type FormState = {
  title: string;
  description: string;
  savingType: string;
  phase: (typeof phases)[number];
  frequency: (typeof frequencies)[number];
  supplier: CreatableValue;
  material: CreatableValue;
  alternativeSupplier: CreatableValue;
  alternativeMaterial: CreatableValue;
  category: CreatableValue;
  plant: CreatableValue;
  businessUnit: CreatableValue;
  buyer: CreatableValue;
  baselinePrice: string;
  newPrice: string;
  annualVolume: string;
  currency: (typeof currencies)[number];
  fxRate: string;
  savingDriver: string;
  implementationComplexity: string;
  qualificationStatus: string;
  startDate: string;
  endDate: string;
  impactStartDate: string;
  impactEndDate: string;
  cancellationReason: string;
};

export function SavingCardForm({ mode, referenceData, card }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedStakeholders, setSelectedStakeholders] = useState<string[]>(
    card?.stakeholders.map((item) => item.userId) ?? []
  );
  const [evidence, setEvidence] = useState<UploadedEvidenceFile[]>(
    card?.evidence.map((item) => ({
      id: item.id,
      fileName: item.fileName,
      fileUrl: item.fileUrl,
      fileSize: item.fileSize,
      fileType: item.fileType,
      status: "uploaded",
      progress: 100
    })) ?? []
  );
  const [alternativeSourcingEnabled, setAlternativeSourcingEnabled] = useState(
    Boolean(card?.alternativeSupplierId || card?.alternativeSupplierManualName || card?.alternativeMaterialId || card?.alternativeMaterialManualName)
  );
  const [form, setForm] = useState<FormState>({
    title: card?.title ?? "",
    description: card?.description ?? "",
    savingType: card?.savingType ?? "",
    phase: card?.phase ?? "IDEA",
    frequency: card?.frequency ?? "RECURRING",
    supplier: existingValue(card?.supplierId, card?.supplier.name),
    material: existingValue(card?.materialId, card?.material.name),
    alternativeSupplier: existingValue(card?.alternativeSupplierId, card?.alternativeSupplier?.name ?? card?.alternativeSupplierManualName),
    alternativeMaterial: existingValue(card?.alternativeMaterialId, card?.alternativeMaterial?.name ?? card?.alternativeMaterialManualName),
    category: existingValue(card?.categoryId, card?.category.name),
    plant: existingValue(card?.plantId, card?.plant.name),
    businessUnit: existingValue(card?.businessUnitId, card?.businessUnit.name),
    buyer: existingValue(card?.buyerId, card?.buyer.name),
    baselinePrice: String(card?.baselinePrice ?? ""),
    newPrice: String(card?.newPrice ?? ""),
    annualVolume: String(card?.annualVolume ?? ""),
    currency: card?.currency ?? "EUR",
    fxRate: String(card?.fxRate ?? 1),
    savingDriver: card?.savingDriver ?? "",
    implementationComplexity: card?.implementationComplexity ?? "",
    qualificationStatus: card?.qualificationStatus ?? "",
    startDate: toDateValue(card?.startDate),
    endDate: toDateValue(card?.endDate),
    impactStartDate: toDateValue(card?.impactStartDate),
    impactEndDate: toDateValue(card?.impactEndDate),
    cancellationReason: card?.cancellationReason ?? ""
  });

  const liveSavings = useMemo(() => {
    const baselinePrice = Number(form.baselinePrice || 0);
    const newPrice = Number(form.newPrice || 0);
    const annualVolume = Number(form.annualVolume || 0);
    const fxRate = Number(form.fxRate || 1);

    return calculateSavings({
      baselinePrice,
      newPrice,
      annualVolume,
      fxRate,
      currency: form.currency
    });
  }, [form.annualVolume, form.baselinePrice, form.currency, form.fxRate, form.newPrice]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      title: form.title,
      description: form.description,
      savingType: form.savingType,
      phase: form.phase,
      supplier: toLookupPayload(form.supplier),
      material: toLookupPayload(form.material),
      alternativeSupplier: alternativeSourcingEnabled ? toLookupPayload(form.alternativeSupplier) : { name: "" },
      alternativeMaterial: alternativeSourcingEnabled ? toLookupPayload(form.alternativeMaterial) : { name: "" },
      category: toLookupPayload(form.category),
      plant: toLookupPayload(form.plant),
      businessUnit: toLookupPayload(form.businessUnit),
      buyer: toLookupPayload(form.buyer),
      baselinePrice: form.baselinePrice,
      newPrice: form.newPrice,
      annualVolume: form.annualVolume,
      currency: form.currency,
      fxRate: form.fxRate,
      frequency: form.frequency,
      savingDriver: form.savingDriver,
      implementationComplexity: form.implementationComplexity,
      qualificationStatus: form.qualificationStatus,
      startDate: form.startDate,
      endDate: form.endDate,
      impactStartDate: form.impactStartDate,
      impactEndDate: form.impactEndDate,
      cancellationReason: form.cancellationReason,
      stakeholderIds: selectedStakeholders,
      evidence: evidence
        .filter((item) => item.status !== "error" && item.fileUrl)
        .map((item) => ({
          id: item.id,
          fileName: item.fileName,
          fileUrl: item.fileUrl,
          fileSize: item.fileSize,
          fileType: item.fileType
        }))
    };

    const endpoint = mode === "create" ? "/api/saving-cards" : `/api/saving-cards/${card?.id}`;
    const method = mode === "create" ? "POST" : "PUT";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error ?? "Unable to save card.");
      setLoading(false);
      return;
    }

    router.push("/saving-cards");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>{mode === "create" ? "Create Saving Card" : "Edit Saving Card"}</CardTitle>
            <CardDescription>
              Create the sourcing case, resolve missing master data inline, and attach the supporting financial evidence before approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <SectionBlock title="Card Basics" description="Define the initiative and choose the phase and value realization pattern.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Title">
                  <Input placeholder="Enter initiative title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
                </Field>
                <Field label="Saving Type">
                  <Input placeholder="Ex: Supplier switch" value={form.savingType} onChange={(event) => setForm({ ...form, savingType: event.target.value })} required />
                </Field>
                <Field label="Description" className="md:col-span-2">
                  <Textarea placeholder="Summarize the sourcing opportunity, business case, and expected impact." value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
                </Field>
                <Field label="Phase">
                  <Select value={form.phase} onChange={(event) => setForm({ ...form, phase: event.target.value as FormState["phase"] })}>
                    {phases.map((phase) => (
                      <option key={phase} value={phase}>
                        {phaseLabels[phase]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Frequency">
                  <Select
                    value={form.frequency}
                    onChange={(event) => setForm({ ...form, frequency: event.target.value as FormState["frequency"] })}
                  >
                    {frequencies.map((frequency) => (
                      <option key={frequency} value={frequency}>
                        {frequency.replaceAll("_", " ")}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </SectionBlock>

            <SectionBlock title="Ownership & Scope" description="Pick an existing master-data record or create one inline without leaving the form.">
              <div className="space-y-5">
                <label className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/45 px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold">Alternative sourcing involved</p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      Enable this when the initiative includes supplier change, material substitution, or both.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={alternativeSourcingEnabled}
                    onClick={() => {
                      const next = !alternativeSourcingEnabled;
                      setAlternativeSourcingEnabled(next);
                      if (!next) {
                        setForm((current) => ({
                          ...current,
                          alternativeSupplier: emptyValue(),
                          alternativeMaterial: emptyValue()
                        }));
                      }
                    }}
                    className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${
                      alternativeSourcingEnabled ? "bg-[var(--primary)]" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                        alternativeSourcingEnabled ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </label>

                <div className="grid gap-5 md:grid-cols-2">
                <CreatableMasterDataField
                  label="Current Supplier"
                  items={referenceData.suppliers}
                  value={form.supplier}
                  onChange={(supplier) => setForm({ ...form, supplier })}
                />
                <CreatableMasterDataField
                  label="Current Material"
                  items={referenceData.materials}
                  value={form.material}
                  onChange={(material) => setForm({ ...form, material })}
                />
                {alternativeSourcingEnabled ? (
                  <CreatableMasterDataField
                    label="Alternative Supplier"
                    items={referenceData.suppliers}
                    value={form.alternativeSupplier}
                    onChange={(alternativeSupplier) => setForm({ ...form, alternativeSupplier })}
                    helper="Optional. Recommended for supplier change initiatives."
                  />
                ) : null}
                {alternativeSourcingEnabled ? (
                  <CreatableMasterDataField
                    label="Alternative Material"
                    items={referenceData.materials}
                    value={form.alternativeMaterial}
                    onChange={(alternativeMaterial) => setForm({ ...form, alternativeMaterial })}
                    helper="Optional. Recommended for material substitution initiatives."
                  />
                ) : null}
                <CreatableMasterDataField
                  label="Category"
                  items={referenceData.categories}
                  value={form.category}
                  onChange={(category) => setForm({ ...form, category })}
                />
                <CreatableMasterDataField
                  label="Plant"
                  items={referenceData.plants}
                  value={form.plant}
                  onChange={(plant) => setForm({ ...form, plant })}
                  helper="New plants default to region Global"
                />
                <CreatableMasterDataField
                  label="Business Unit"
                  items={referenceData.businessUnits}
                  value={form.businessUnit}
                  onChange={(businessUnit) => setForm({ ...form, businessUnit })}
                />
                <div className="space-y-2">
                  <Label>Buyer</Label>
                  <SearchableUserSelect
                    users={referenceData.users}
                    value={form.buyer.id}
                    onChange={(userId) => {
                      const user = referenceData.users.find((item) => item.id === userId);
                      if (!user) return;
                      setForm({ ...form, buyer: existingValue(user.id, user.name) });
                    }}
                    placeholder="Search buyers"
                  />
                  <p className="text-[12px] leading-5 text-[var(--muted-foreground)]">Select the accountable buyer from the user directory.</p>
                </div>
                </div>
                {(form.savingType.toLowerCase().includes("supplier") || form.savingType.toLowerCase().includes("material")) && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {form.savingType.toLowerCase().includes("supplier")
                      ? "Alternative supplier is recommended for supplier change savings types."
                      : null}
                    {form.savingType.toLowerCase().includes("supplier") && form.savingType.toLowerCase().includes("material") ? " " : null}
                    {form.savingType.toLowerCase().includes("material")
                      ? "Alternative material is recommended for material substitution savings types."
                      : null}
                  </div>
                )}
              </div>
            </SectionBlock>

            <SectionBlock title="Financials" description="Live savings are calculated as soon as the pricing inputs change.">
              <div className="grid gap-4 md:grid-cols-3">
                <Field
                  label="Baseline Price"
                  tooltip="Last purchase order price used as the starting commercial baseline."
                  helper="Use the latest purchase order price before the initiative starts."
                >
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.baselinePrice}
                    onChange={(event) => setForm({ ...form, baselinePrice: event.target.value })}
                    required
                  />
                </Field>
                <Field
                  label="New Price"
                  tooltip="Expected or negotiated future price after the initiative is implemented."
                  helper="Enter the expected negotiated or scenario price."
                >
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.newPrice}
                    onChange={(event) => setForm({ ...form, newPrice: event.target.value })}
                    required
                  />
                </Field>
                <Field
                  label="Annual Volume"
                  tooltip="Expected yearly purchased volume affected by the saving case."
                  helper="Used directly in the savings formula."
                >
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={form.annualVolume}
                    onChange={(event) => setForm({ ...form, annualVolume: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Currency">
                  <Select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as FormState["currency"] })}>
                    {currencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="FX Rate">
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="1.0000"
                    value={form.fxRate}
                    onChange={(event) => setForm({ ...form, fxRate: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Cancellation Reason">
                  <Input placeholder="Only required if cancelled" value={form.cancellationReason} onChange={(event) => setForm({ ...form, cancellationReason: event.target.value })} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <SummaryMetric label="Calculated Savings" value={formatCurrency(Math.round(liveSavings.savingsEUR), "EUR")} />
                <SummaryMetric label="Calculated Savings (USD)" value={formatCurrency(Math.round(liveSavings.savingsUSD), "USD")} />
                <SummaryMetric label="Savings Formula" value="(Baseline - New) x Annual Volume" muted />
              </div>
            </SectionBlock>

            <SectionBlock title="Project Attributes" description="Capture the nature of the saving initiative, delivery effort, and validation maturity.">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Saving Driver" tooltip="Root cause of the saving initiative.">
                  <Select value={form.savingDriver} onChange={(event) => setForm({ ...form, savingDriver: event.target.value })}>
                    <option value="">Select saving driver</option>
                    {savingDrivers.map((driver) => (
                      <option key={driver} value={driver}>
                        {driver}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Implementation Complexity"
                  tooltip="Estimated effort required to implement this saving."
                >
                  <Select
                    value={form.implementationComplexity}
                    onChange={(event) => setForm({ ...form, implementationComplexity: event.target.value })}
                  >
                    <option value="">Select complexity</option>
                    {implementationComplexities.map((complexity) => (
                      <option key={complexity} value={complexity}>
                        {complexity}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Qualification Status"
                  tooltip="Engineering or operational validation stage of the saving initiative."
                >
                  <Select
                    value={form.qualificationStatus}
                    onChange={(event) => setForm({ ...form, qualificationStatus: event.target.value })}
                  >
                    <option value="">Select qualification status</option>
                    {qualificationStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </SectionBlock>

            <SectionBlock title="Timing" description="Separate project execution dates from value-recognition dates for finance reporting.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Start Date">
                  <Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required />
                </Field>
                <Field label="End Date">
                  <Input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required />
                </Field>
                <Field label="Impact Start Date">
                  <Input
                    type="date"
                    value={form.impactStartDate}
                    onChange={(event) => setForm({ ...form, impactStartDate: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Impact End Date">
                  <Input
                    type="date"
                    value={form.impactEndDate}
                    onChange={(event) => setForm({ ...form, impactEndDate: event.target.value })}
                    required
                  />
                </Field>
              </div>
            </SectionBlock>

            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">Stakeholders</CardTitle>
                <CardDescription>Select the people who should be visible on the card and involved in the workflow.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SearchableUserMultiSelect
                  users={referenceData.users}
                  selectedUserIds={selectedStakeholders}
                  onChange={setSelectedStakeholders}
                  placeholder="Search stakeholders"
                />
                <p className="text-[12px] leading-5 text-[var(--muted-foreground)]">
                  Search by name, email, or role to assign procurement, finance, sales, production, and development stakeholders consistently.
                </p>
              </CardContent>
            </Card>

            <EvidenceUploader files={evidence} onChange={setEvidence} onError={setUploadError} />

            {uploadError ? <p className="text-sm text-red-600">{uploadError}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : mode === "create" ? "Create Card" : "Update Card"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="sticky top-6 overflow-hidden">
          <CardHeader>
            <CardTitle>Decision Summary</CardTitle>
            <CardDescription>Approvers can verify scope, financial assumptions, and evidence readiness at a glance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow label="Indicative Savings" value={formatCurrency(Math.round(liveSavings.savingsEUR), "EUR")} />
            <InfoRow label="Current Phase" value={phaseLabels[form.phase]} />
            <InfoRow label="Alternative Sourcing" value={alternativeSourcingEnabled ? "Enabled" : "Not involved"} />
            <InfoRow label="Saving Driver" value={form.savingDriver || "Not set"} />
            <InfoRow label="Implementation Complexity" value={form.implementationComplexity || "Not set"} />
            <InfoRow label="Qualification Status" value={form.qualificationStatus || "Not set"} />
            <InfoRow label="Stakeholders" value={selectedStakeholders.length ? String(selectedStakeholders.length) : "None"} />
            <InfoRow label="Evidence Files" value={String(evidence.filter((item) => item.fileUrl).length)} />
            {alternativeSourcingEnabled ? (
              <>
                <InfoRow label="Alternative Supplier" value={form.alternativeSupplier.name || "Not specified"} />
                <InfoRow label="Alternative Material" value={form.alternativeMaterial.name || "Not specified"} />
              </>
            ) : null}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/55 p-4 text-sm leading-6 text-[var(--muted-foreground)]">
              Savings calculation:
              <span className="font-semibold text-[var(--foreground)]"> (Baseline price - New price) x Annual volume</span>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/55 p-4 text-sm leading-6 text-[var(--muted-foreground)]">
              Finance lock protects baseline price, new price, annual volume, currency, and impact dates once finance validates the card.
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function existingValue(id?: string | null, name?: string | null): CreatableValue {
  return {
    id: id ?? undefined,
    name: name ?? "",
    mode: id ? "existing" : "new"
  };
}

function emptyValue(): CreatableValue {
  return {
    id: undefined,
    name: "",
    mode: "new"
  };
}

function toLookupPayload(value: CreatableValue) {
  return {
    id: value.mode === "existing" ? value.id : undefined,
    name: value.name
  };
}

function Field({
  label,
  className,
  tooltip,
  helper,
  children
}: {
  label: string;
  className?: string;
  tooltip?: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-2">
        <Label>{label}</Label>
        {tooltip ? (
          <span title={tooltip}>
            <Info className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
          </span>
        ) : null}
      </div>
      {children}
      {helper ? <p className="mt-2 text-[12px] leading-5 text-[var(--muted-foreground)]">{helper}</p> : null}
    </div>
  );
}

function SectionBlock({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-3xl border border-[var(--border)] bg-white p-5">
      <div className="border-b border-[var(--border)] pb-4">
        <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
        <p className="mt-1 text-[13px] leading-6 text-[var(--muted-foreground)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SummaryMetric({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`rounded-2xl border border-[var(--border)] p-4 ${muted ? "bg-[var(--muted)]/35" : "bg-[var(--muted)]/45"}`}>
      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-[1.15rem] font-semibold tracking-[-0.02em]">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 px-3 py-3">
      <span className="text-[13px] text-[var(--muted-foreground)]">{label}</span>
      <span className="text-right text-[13px] font-semibold">{value}</span>
    </div>
  );
}

function SearchableUserSelect({
  users,
  value,
  onChange,
  placeholder
}: {
  users: Array<{ id: string; name: string; email: string; role: keyof typeof roleLabels }>;
  value?: string;
  onChange: (userId: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((user) =>
      `${user.name} ${user.email} ${roleLabels[user.role]}`.toLowerCase().includes(normalized)
    );
  }, [query, users]);

  const selected = users.find((user) => user.id === value);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm"
      >
        <span className={selected ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}>
          {selected ? formatUserOption(selected) : placeholder}
        </span>
        <span className="text-[var(--muted-foreground)]">{open ? "Close" : "Select"}</span>
      </button>
      {open ? (
        <div className="border-t border-[var(--border)] p-3">
          <Input placeholder={placeholder} value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
            {filtered.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => {
                  onChange(user.id);
                  setQuery("");
                  setOpen(false);
                }}
                className={`w-full rounded-2xl border px-3 py-3 text-left text-sm ${
                  user.id === value ? "border-[var(--primary)] bg-[var(--secondary)]/55" : "border-[var(--border)] bg-[var(--muted)]/30"
                }`}
              >
                <p className="font-medium">{user.name}</p>
                <p className="text-[12px] text-[var(--muted-foreground)]">{roleLabels[user.role]}</p>
              </button>
            ))}
            {filtered.length === 0 ? <p className="text-sm text-[var(--muted-foreground)]">No users found.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SearchableUserMultiSelect({
  users,
  selectedUserIds,
  onChange,
  placeholder
}: {
  users: Array<{ id: string; name: string; email: string; role: keyof typeof roleLabels }>;
  selectedUserIds: string[];
  onChange: (userIds: string[]) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((user) =>
      `${user.name} ${user.email} ${roleLabels[user.role]}`.toLowerCase().includes(normalized)
    );
  }, [query, users]);

  const selectedUsers = users.filter((user) => selectedUserIds.includes(user.id));

  return (
    <div className="space-y-3">
      <Input placeholder={placeholder} value={query} onChange={(event) => setQuery(event.target.value)} />
      {selectedUsers.length ? (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onChange(selectedUserIds.filter((id) => id !== user.id))}
              className="rounded-full border border-[var(--border)] bg-[var(--secondary)]/45 px-3 py-1.5 text-xs font-medium text-[var(--foreground)]"
            >
              {user.name} · {roleLabels[user.role]}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid gap-2 md:grid-cols-2">
        {filtered.map((user) => {
          const checked = selectedUserIds.includes(user.id);
          return (
            <button
              key={user.id}
              type="button"
              onClick={() =>
                onChange(checked ? selectedUserIds.filter((id) => id !== user.id) : [...selectedUserIds, user.id])
              }
              className={`rounded-2xl border px-3 py-3 text-left text-sm ${
                checked ? "border-[var(--primary)] bg-[var(--secondary)]/55" : "border-[var(--border)] bg-[var(--muted)]/30"
              }`}
            >
              <p className="font-medium">{user.name}</p>
              <p className="text-[12px] text-[var(--muted-foreground)]">{roleLabels[user.role]}</p>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 ? <p className="text-sm text-[var(--muted-foreground)]">No users found.</p> : null}
    </div>
  );
}

function formatUserOption(user: { name: string; role: keyof typeof roleLabels }) {
  return `${user.name} - ${roleLabels[user.role]}`;
}

function toDateValue(value?: string | Date) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}
