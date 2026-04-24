"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useMemo, useRef, useState } from "react";
import { Check, Info } from "lucide-react";
import { CreatableMasterDataField, type CreatableValue } from "@/components/saving-cards/creatable-master-data-field";
import { EvidenceUploader, type UploadedEvidenceFile } from "@/components/saving-cards/evidence-uploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhaseBadge } from "@/components/ui/phase-badge";
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
import { cn } from "@/lib/utils";
import { formatCurrency, formatPlainNumber } from "@/lib/utils/numberFormatter";
import type { SavingCardWithRelations } from "@/lib/types";

type ReferenceData = Awaited<ReturnType<typeof import("@/lib/data").getReferenceData>>;
type WorkspaceReadiness = Awaited<ReturnType<typeof import("@/lib/data").getWorkspaceReadiness>>;

type Props = {
  mode: "create" | "edit";
  referenceData: ReferenceData;
  workspaceReadiness?: WorkspaceReadiness | null;
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

type WizardStepId = 1 | 2 | 3;

const createModeSteps: Array<{ id: WizardStepId; title: string }> = [
  { id: 1, title: "Basic Info" },
  { id: 2, title: "Financial Assumptions" },
  { id: 3, title: "Team & Timeline" },
];

export function SavingCardForm({ mode, referenceData, workspaceReadiness, card }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<WizardStepId>(1);
  const [selectedStakeholders, setSelectedStakeholders] = useState<string[]>(
    card?.stakeholders.map((item) => item.userId) ?? []
  );
  const [evidence, setEvidence] = useState<UploadedEvidenceFile[]>(
    card?.evidence.map((item) => ({
      id: item.id,
      fileName: item.fileName,
      downloadUrl: `/api/evidence/${item.id}/download`,
      fileSize: item.fileSize,
      fileType: item.fileType,
      status: "uploaded",
      progress: 100,
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
  const isNegativeSavings = liveSavings.savingsEUR < 0;
  const missingCoreSetup = workspaceReadiness?.missingCoreSetup ?? [];
  const showSetupCallout = mode === "create" && missingCoreSetup.length > 0;
  const inlineFirstCardSetupGaps = getInlineFirstCardSetupGaps(referenceData);
  const showInlineCreationPriorityCallout =
    mode === "create" && inlineFirstCardSetupGaps.length > 0;
  const isCreateMode = mode === "create";
  const isFinalCreateStep = currentStep === createModeSteps.length;
  const financeLockActive = Boolean(card?.financeLocked);
  const linkedEvidenceCount = evidence.filter((item) => item.status !== "error" && item.id).length;
  const evidenceIssueCount = evidence.filter((item) => item.status === "error").length;
  const pendingPhaseRequest =
    card?.phaseChangeRequests.find((request) => request.approvalStatus === "PENDING") ?? null;
  const approvalStatus = getApprovalStatusLabel({
    isCreateMode,
    hasPendingRequest: Boolean(pendingPhaseRequest),
    approvalCount: card?.approvals.length ?? 0,
  });
  const approvalStatusTone = pendingPhaseRequest ? "amber" : card?.approvals.length ? "emerald" : "slate";

  const supplierHelper = buildMasterDataHelper({
    count: referenceData.suppliers.length,
    singular: "supplier",
    plural: "suppliers",
    emptyMessage: "Create the first supplier inline from this card.",
  });
  const materialHelper = buildMasterDataHelper({
    count: referenceData.materials.length,
    singular: "material",
    plural: "materials",
    emptyMessage: "Create the first material inline from this card.",
  });
  const alternativeSupplierHelper = buildMasterDataHelper({
    count: referenceData.suppliers.length,
    singular: "supplier",
    plural: "suppliers",
    emptyMessage: "Optional. Create an alternative supplier inline if this initiative depends on one.",
    availableMessage: "Optional. Recommended for supplier change initiatives.",
  });
  const alternativeMaterialHelper = buildMasterDataHelper({
    count: referenceData.materials.length,
    singular: "material",
    plural: "materials",
    emptyMessage: "Optional. Create an alternative material inline if this initiative depends on one.",
    availableMessage: "Optional. Recommended for material substitution initiatives.",
  });
  const categoryHelper = buildMasterDataHelper({
    count: referenceData.categories.length,
    singular: "category",
    plural: "categories",
    emptyMessage: "Create the first category inline from this card.",
  });
  const plantHelper = buildMasterDataHelper({
    count: referenceData.plants.length,
    singular: "plant",
    plural: "plants",
    emptyMessage: "Create the first plant inline. New plants default to region Global.",
    availableMessage: "New plants default to region Global.",
  });
  const businessUnitHelper = buildMasterDataHelper({
    count: referenceData.businessUnits.length,
    singular: "business unit",
    plural: "business units",
    emptyMessage: "Create the first business unit inline to complete ownership reporting.",
  });
  const buyerHelper = buildMasterDataHelper({
    count: referenceData.buyers.length,
    singular: "buyer",
    plural: "buyers",
    emptyMessage: "Create the first buyer inline from this card.",
    availableMessage: "Pick the accountable buyer or type a new one inline.",
  });

  function validateCreateStep(step: WizardStepId) {
    setError(null);

    if (!formRef.current?.reportValidity()) {
      return false;
    }

    const requiredByStep: Record<WizardStepId, Array<{ label: string; value: string }>> = {
      1: [
        { label: "Category", value: form.category.name },
        { label: "Plant", value: form.plant.name },
        { label: "Business Unit", value: form.businessUnit.name },
        { label: "Buyer", value: form.buyer.name },
      ],
      2: [
        { label: "Current Supplier", value: form.supplier.name },
        { label: "Current Material", value: form.material.name },
      ],
      3: [],
    };

    const missingRequiredMasterData = requiredByStep[step].find(
      (field) => !field.value.trim()
    );

    if (missingRequiredMasterData) {
      setError(
        `${missingRequiredMasterData.label} is required. Select an existing record or create one inline before continuing.`
      );
      return false;
    }

    if (step === 1 && form.phase === "CANCELLED" && !form.cancellationReason.trim()) {
      setError("Cancellation reason is required when a card is cancelled.");
      return false;
    }

    return true;
  }

  function goToNextCreateStep() {
    if (!validateCreateStep(currentStep)) {
      return;
    }

    setCurrentStep((step) => Math.min(step + 1, createModeSteps.length) as WizardStepId);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isCreateMode && !isFinalCreateStep) {
      goToNextCreateStep();
      return;
    }

    setLoading(true);
    setError(null);

    const missingRequiredMasterData = [
      { label: "Current Supplier", value: form.supplier.name },
      { label: "Current Material", value: form.material.name },
      { label: "Category", value: form.category.name },
      { label: "Plant", value: form.plant.name },
      { label: "Business Unit", value: form.businessUnit.name },
      { label: "Buyer", value: form.buyer.name },
    ].find((field) => !field.value.trim());

    if (missingRequiredMasterData) {
      setError(
        `${missingRequiredMasterData.label} is required. Select an existing record or create one inline before saving the card.`
      );
      setLoading(false);
      return;
    }

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
        .filter((item) => item.status !== "error" && item.id)
        .map((item) => ({
          id: item.id,
          fileName: item.fileName,
          fileSize: item.fileSize,
          fileType: item.fileType,
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
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="grid gap-8 xl:grid-cols-[minmax(0,1.18fr)_360px] xl:items-start"
    >
      <div className="space-y-8">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/75">
            <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">
              Saving Card
            </p>
            <CardTitle className="text-[1.65rem] tracking-[-0.03em]">
              {mode === "create" ? "Create Saving Card" : "Edit Saving Card"}
            </CardTitle>
            <CardDescription className="max-w-3xl text-[14px] leading-6">
              Capture the sourcing case, assign ownership, and keep the commercial assumptions easy to review before workflow approval.
            </CardDescription>
            <div className="flex flex-wrap gap-2 pt-2">
              <PhaseBadge phase={form.phase}>{phaseLabels[form.phase]}</PhaseBadge>
              <Badge tone="slate">
                {isCreateMode ? `Step ${currentStep} of ${createModeSteps.length}` : "All sections open"}
              </Badge>
              <Badge tone={financeLockActive ? "lock" : "slate"}>
                {financeLockActive ? "Finance lock active" : "Finance lock open"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {showSetupCallout ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-4 text-sm text-amber-900">
                <p className="font-semibold">Shared setup is still in progress</p>
                <p className="mt-1">
                  Missing today: {missingCoreSetup.join(", ")}. This form stays usable, so keep moving here and create any missing records inline as you go.
                </p>
              </div>
            ) : null}

            {showInlineCreationPriorityCallout ? (
              <div className="rounded-2xl border border-[rgba(37,99,235,0.2)] bg-[rgba(37,99,235,0.06)] px-4 py-4 text-sm text-[var(--foreground)]">
                <p className="font-semibold">Start with the card. Shared setup can happen inline.</p>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  No {formatInlineSetupList(inlineFirstCardSetupGaps)} exist in this workspace yet. Create them directly from this form and Traxium will add them to the active workspace when the card is saved.
                </p>
              </div>
            ) : null}

            {isCreateMode ? (
              <WizardStepIndicator currentStep={currentStep} steps={createModeSteps} />
            ) : null}

            {!isCreateMode || currentStep === 1 ? (
              <>
                <SectionBlock title="Record Definition" description="Start with the business narrative and governance posture of the initiative before filling in commercial detail.">
                  <div className="grid gap-5 lg:grid-cols-2">
                    <Field label="Title">
                      <Input
                        placeholder="Enter initiative title"
                        value={form.title}
                        onChange={(event) => setForm({ ...form, title: event.target.value })}
                        required
                      />
                    </Field>
                    <Field label="Saving Type">
                      <Input
                        placeholder="Ex: Supplier switch"
                        value={form.savingType}
                        onChange={(event) => setForm({ ...form, savingType: event.target.value })}
                        required
                      />
                    </Field>
                    <Field label="Description" className="md:col-span-2" optional>
                      <Textarea
                        placeholder="Summarize the sourcing opportunity, business case, and expected impact."
                        value={form.description}
                        onChange={(event) => setForm({ ...form, description: event.target.value })}
                        required
                      />
                    </Field>
                    <Field label="Phase">
                      <Select
                        value={form.phase}
                        onChange={(event) => setForm({ ...form, phase: event.target.value as FormState["phase"] })}
                      >
                        {phases.map((phase) => (
                          <option key={phase} value={phase}>
                            {phaseLabels[phase]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Cancellation Reason" optional>
                      <Input
                        placeholder="Only required if cancelled"
                        value={form.cancellationReason}
                        onChange={(event) => setForm({ ...form, cancellationReason: event.target.value })}
                      />
                    </Field>
                  </div>
                </SectionBlock>

                <SectionBlock title="Ownership & Scope" description="Map the record to shared master data so ownership, reporting, and accountability are aligned from the outset. If a list is empty, create the first record inline and keep going.">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <CreatableMasterDataField
                      label="Category"
                      items={referenceData.categories}
                      value={form.category}
                      onChange={(category) => setForm({ ...form, category })}
                      helper={categoryHelper}
                    />
                    <CreatableMasterDataField
                      label="Buyer"
                      items={referenceData.buyers}
                      value={form.buyer}
                      onChange={(buyer) => setForm({ ...form, buyer })}
                      helper={buyerHelper}
                    />
                    <CreatableMasterDataField
                      label="Business Unit"
                      items={referenceData.businessUnits}
                      value={form.businessUnit}
                      onChange={(businessUnit) => setForm({ ...form, businessUnit })}
                      helper={businessUnitHelper}
                    />
                    <CreatableMasterDataField
                      label="Plant"
                      items={referenceData.plants}
                      value={form.plant}
                      onChange={(plant) => setForm({ ...form, plant })}
                      helper={plantHelper}
                    />
                  </div>
                </SectionBlock>

                <SectionBlock title="Governance Attributes" description="Capture the driver, delivery effort, and validation maturity that shape how the initiative is reviewed.">
                  <div className="grid gap-5 lg:grid-cols-3">
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
              </>
            ) : null}

            {!isCreateMode || currentStep === 2 ? (
              <>
                <SectionBlock title="Commercial Baseline" description="Define the baseline sourcing position first, then capture any alternative supplier or material scenario that supports the case. Missing suppliers or materials can be created inline without leaving this flow.">
                  <div className="space-y-6">
                    <label className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 px-4 py-4">
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

                    <div className="grid gap-6 lg:grid-cols-2">
                      <CreatableMasterDataField
                        label="Current Supplier"
                        items={referenceData.suppliers}
                        value={form.supplier}
                        onChange={(supplier) => setForm({ ...form, supplier })}
                        helper={supplierHelper}
                      />
                      <CreatableMasterDataField
                        label="Current Material"
                        items={referenceData.materials}
                        value={form.material}
                        onChange={(material) => setForm({ ...form, material })}
                        helper={materialHelper}
                      />
                      {alternativeSourcingEnabled ? (
                        <CreatableMasterDataField
                          label="Alternative Supplier"
                          labelSuffix={<OptionalLabelText />}
                          items={referenceData.suppliers}
                          value={form.alternativeSupplier}
                          onChange={(alternativeSupplier) => setForm({ ...form, alternativeSupplier })}
                          helper={alternativeSupplierHelper}
                        />
                      ) : null}
                      {alternativeSourcingEnabled ? (
                        <CreatableMasterDataField
                          label="Alternative Material"
                          labelSuffix={<OptionalLabelText />}
                          items={referenceData.materials}
                          value={form.alternativeMaterial}
                          onChange={(alternativeMaterial) => setForm({ ...form, alternativeMaterial })}
                          helper={alternativeMaterialHelper}
                        />
                      ) : null}
                    </div>

                    {(form.savingType.toLowerCase().includes("supplier") || form.savingType.toLowerCase().includes("material")) && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
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

                <SectionBlock title="Financial Assumptions" description="Enter finance-critical inputs in one place, then validate the live calculation before the record moves into workflow.">
                  <div className="space-y-6">
                    {financeLockActive ? (
                      <div className="rounded-2xl border border-[rgba(71,84,103,0.22)] bg-[var(--finance-lock-surface)] px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="lock">Finance lock active</Badge>
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            Finance-controlled fields stay visually grouped here.
                          </p>
                        </div>
                        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                          Baseline price, new price, annual volume, currency, FX rate, and value recognition dates are the core finance control points for this record.
                        </p>
                      </div>
                    ) : null}

                    <div className="space-y-4">
                      <SectionLabel title="Commercial Inputs" description="These values drive the live savings calculation immediately." />
                      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                        <Field
                          label="Baseline Price"
                          tooltip="Last purchase order price used as the starting commercial baseline."
                          helper="Use the latest purchase order price before the initiative starts."
                          emphasis="finance"
                          locked={financeLockActive}
                          statusLabel={financeLockActive ? "Finance-controlled" : "Critical input"}
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
                          emphasis="finance"
                          locked={financeLockActive}
                          statusLabel={financeLockActive ? "Finance-controlled" : "Critical input"}
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
                          emphasis="finance"
                          locked={financeLockActive}
                          statusLabel={financeLockActive ? "Finance-controlled" : "Critical input"}
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
                      </div>

                      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                        <Field
                          label="Currency"
                          emphasis="finance"
                          locked={financeLockActive}
                          statusLabel={financeLockActive ? "Finance-controlled" : "Critical input"}
                        >
                          <Select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as FormState["currency"] })}>
                            {currencies.map((currency) => (
                              <option key={currency} value={currency}>
                                {currency}
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
                        <Field
                          label="FX Rate"
                          optional
                          emphasis="finance"
                          locked={financeLockActive}
                          statusLabel={financeLockActive ? "Finance-controlled" : "Conversion input"}
                        >
                          <Input
                            type="number"
                            step="0.0001"
                            placeholder="1.0000"
                            value={form.fxRate}
                            onChange={(event) => setForm({ ...form, fxRate: event.target.value })}
                            required
                          />
                        </Field>
                      </div>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-4">
                      <InlineCalculationCue
                        label="Baseline Annual Spend"
                        value={formatCurrency(Math.round(Number(form.baselinePrice || 0) * Number(form.annualVolume || 0)), form.currency)}
                        detail="Baseline price x annual volume"
                      />
                      <InlineCalculationCue
                        label="Projected Annual Spend"
                        value={formatCurrency(Math.round(Number(form.newPrice || 0) * Number(form.annualVolume || 0)), form.currency)}
                        detail="New price x annual volume"
                      />
                      <InlineCalculationCue
                        label="Unit Delta"
                        value={formatCurrency(Math.round(Number(form.baselinePrice || 0) - Number(form.newPrice || 0)), form.currency)}
                        detail="Per-unit price difference"
                      />
                      <InlineCalculationCue
                        label="FX Translation"
                        value={`${form.currency} x ${form.fxRate || "1"}`}
                        detail="Applied before EUR and USD outputs"
                      />
                    </div>

                    <div
                      className={cn(
                        "rounded-[8px] border px-4 py-3",
                        isNegativeSavings
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-[#ddd6fe] bg-[#ede9fe] text-[#4f46e5]"
                      )}
                    >
                      <p className="text-sm font-semibold">
                        Calculated Savings: {formatCurrency(Math.round(liveSavings.savingsEUR), "EUR")}
                      </p>
                      {isNegativeSavings ? (
                        <p className="mt-1 text-sm">⚠ New price is higher</p>
                      ) : null}
                    </div>

                    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/18 p-4 md:p-5">
                      <SectionLabel title="Calculated View" description="Use this as a quick cross-check before submitting the card." />
                      <div className="grid gap-4 md:grid-cols-3">
                        <SummaryMetric label="Calculated Savings" value={formatCurrency(Math.round(liveSavings.savingsEUR), "EUR")} />
                        <SummaryMetric label="Calculated Savings (USD)" value={formatCurrency(Math.round(liveSavings.savingsUSD), "USD")} />
                        <SummaryMetric label="Savings Formula" value="(Baseline - New) x Annual Volume" muted />
                      </div>
                    </div>
                  </div>
                </SectionBlock>
              </>
            ) : null}

            {!isCreateMode || currentStep === 3 ? (
              <>
                <SectionBlock title="Execution & Value Timing" description="Keep operational delivery dates separate from the dates used by finance to recognize value.">
                  <div className="grid gap-5 lg:grid-cols-2">
                    <SubsectionPanel title="Execution Timeline" description="When the initiative work starts and ends.">
                      <div className="grid gap-5">
                        <Field
                          label="Start Date"
                          emphasis="timeline"
                          statusLabel={financeLockActive ? "Finance-visible" : "Timeline input"}
                        >
                          <Input
                            type="date"
                            value={form.startDate}
                            onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                            required
                          />
                        </Field>
                        <Field
                          label="End Date"
                          emphasis="timeline"
                          statusLabel={financeLockActive ? "Finance-visible" : "Timeline input"}
                        >
                          <Input
                            type="date"
                            value={form.endDate}
                            onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                            required
                          />
                        </Field>
                      </div>
                    </SubsectionPanel>
                    <SubsectionPanel title="Value Recognition" description="When finance should recognize the commercial impact.">
                      <div className="grid gap-5">
                        <Field
                          label="Impact Start Date"
                          optional
                          emphasis="finance"
                          locked={financeLockActive}
                          statusLabel={financeLockActive ? "Finance-controlled" : "Recognition date"}
                        >
                          <Input
                            type="date"
                            value={form.impactStartDate}
                            onChange={(event) => setForm({ ...form, impactStartDate: event.target.value })}
                            required
                          />
                        </Field>
                        <Field
                          label="Impact End Date"
                          optional
                          emphasis="finance"
                          locked={financeLockActive}
                          statusLabel={financeLockActive ? "Finance-controlled" : "Recognition date"}
                        >
                          <Input
                            type="date"
                            value={form.impactEndDate}
                            onChange={(event) => setForm({ ...form, impactEndDate: event.target.value })}
                            required
                          />
                        </Field>
                      </div>
                    </SubsectionPanel>
                  </div>
                </SectionBlock>

                <SectionBlock title="Stakeholder Coverage" description="Select the people who should see the record, provide evidence, or contribute to the approval journey.">
                  <Field
                    label="Stakeholders"
                    optional
                    helper="Search by name, email, or role to assign procurement, finance, sales, production, and development stakeholders consistently."
                  >
                    <SearchableUserMultiSelect
                      users={referenceData.users}
                      selectedUserIds={selectedStakeholders}
                      onChange={setSelectedStakeholders}
                      placeholder="Search stakeholders"
                    />
                  </Field>
                </SectionBlock>

                <SectionBlock title="Evidence Register" description="Keep supporting documents with the record so review and finance validation can happen from one place.">
                  {card?.id ? (
                    <EvidenceUploader
                      savingCardId={card.id}
                      files={evidence}
                      onChange={setEvidence}
                      onError={setUploadError}
                    />
                  ) : (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/55 px-4 py-4 text-sm text-[var(--muted-foreground)]">
                      Save the card first, then upload supporting evidence.
                    </div>
                  )}
                </SectionBlock>
              </>
            ) : null}

            <div className="space-y-3 border-t border-[var(--border)] pt-6">
              {uploadError ? <p className="text-sm text-red-600">{uploadError}</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              {isCreateMode ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="button" variant="ghost" onClick={() => router.back()}>
                    Cancel
                  </Button>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setError(null);
                        setCurrentStep((step) => Math.max(step - 1, 1) as WizardStepId);
                      }}
                      disabled={currentStep === 1 || loading}
                    >
                      Back
                    </Button>
                    {isFinalCreateStep ? (
                      <Button type="submit" disabled={loading}>
                        {loading ? "Saving..." : "Save"}
                      </Button>
                    ) : (
                      <Button type="button" onClick={goToNextCreateStep}>
                        Next
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button type="button" variant="ghost" onClick={() => router.back()}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Saving..." : "Update Card"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="sticky top-6 overflow-hidden">
          <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/75">
            <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">
              Record Summary
            </p>
            <CardTitle>Decision Snapshot</CardTitle>
            <CardDescription>Keep the most decision-relevant signals visible while you complete or update the record.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/75 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] text-[var(--muted-foreground)]">Indicative Savings</p>
                  <p className="mt-2 text-[1.4rem] font-semibold tracking-[-0.03em]">
                    {formatCurrency(Math.round(liveSavings.savingsEUR), "EUR")}
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                    {isNegativeSavings ? "Current assumptions indicate value erosion." : "Current assumptions indicate positive annualized value."}
                  </p>
                </div>
                <PhaseBadge phase={form.phase}>{phaseLabels[form.phase]}</PhaseBadge>
              </div>
            </div>

            <SummaryGroup title="Financial Summary">
              <InfoRow
                label="Baseline Price"
                value={form.baselinePrice ? formatCurrency(Number(form.baselinePrice), form.currency) : "Not set"}
              />
              <InfoRow
                label="New Price"
                value={form.newPrice ? formatCurrency(Number(form.newPrice), form.currency) : "Not set"}
              />
              <InfoRow
                label="Annual Volume"
                value={form.annualVolume ? formatPlainNumber(Number(form.annualVolume)) : "Not set"}
              />
              <InfoRow label="Currency / FX" value={`${form.currency} / ${form.fxRate || "1"}`} />
            </SummaryGroup>

            <SummaryGroup title="Calculation Summary">
              <InfoRow label="Calculated Savings (EUR)" value={formatCurrency(Math.round(liveSavings.savingsEUR), "EUR")} />
              <InfoRow label="Calculated Savings (USD)" value={formatCurrency(Math.round(liveSavings.savingsUSD), "USD")} />
              <InfoRow label="Formula" value="(Baseline - New) x Annual Volume" />
              <InfoRow label="Frequency" value={form.frequency.replaceAll("_", " ")} />
            </SummaryGroup>

            <SummaryGroup title="Ownership & Scope">
              <InfoRow label="Buyer" value={form.buyer.name || "Not set"} />
              <InfoRow label="Category" value={form.category.name || "Not set"} />
              <InfoRow label="Business Unit" value={form.businessUnit.name || "Not set"} />
              <InfoRow label="Plant" value={form.plant.name || "Not set"} />
            </SummaryGroup>

            <SummaryGroup title="Evidence & Workflow">
              <InfoRow label="Alternative Sourcing" value={alternativeSourcingEnabled ? "Enabled" : "Not involved"} />
              <InfoRow label="Stakeholders" value={selectedStakeholders.length ? String(selectedStakeholders.length) : "None"} />
              <InfoRow
                label="Evidence Files"
                value={`${linkedEvidenceCount}${evidenceIssueCount ? ` linked, ${evidenceIssueCount} issue` : " linked"}`}
              />
              <InfoRow
                label="Approval Status"
                value={<Badge tone={approvalStatusTone}>{approvalStatus}</Badge>}
              />
              <InfoRow
                label="Finance Lock"
                value={<Badge tone={financeLockActive ? "lock" : "slate"}>{financeLockActive ? "Locked" : "Open"}</Badge>}
              />
            </SummaryGroup>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/55 p-4 text-sm leading-6 text-[var(--muted-foreground)]">
              Finance-controlled fields:{" "}
              <span className="font-semibold text-[var(--foreground)]">
                baseline price, new price, annual volume, currency, FX rate, and impact dates
              </span>
              .
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

function getInlineFirstCardSetupGaps(referenceData: ReferenceData) {
  return [
    { key: "buyers", label: "buyers", count: referenceData.buyers.length },
    { key: "suppliers", label: "suppliers", count: referenceData.suppliers.length },
    { key: "materials", label: "materials", count: referenceData.materials.length },
    { key: "categories", label: "categories", count: referenceData.categories.length },
  ]
    .filter((item) => item.count === 0)
    .map((item) => item.label);
}

function formatInlineSetupList(items: string[]) {
  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function buildMasterDataHelper({
  count,
  singular,
  plural,
  emptyMessage,
  availableMessage,
}: {
  count: number;
  singular: string;
  plural: string;
  emptyMessage: string;
  availableMessage?: string;
}) {
  if (count === 0) {
    return `No ${plural} yet. ${emptyMessage}`;
  }

  const availability = count === 1
    ? `1 ${singular} available`
    : `${count} ${plural} available`;

  return availableMessage
    ? `${availability}. ${availableMessage}`
    : `${availability}. Select existing or type a new one inline.`;
}

function Field({
  label,
  className,
  tooltip,
  helper,
  optional,
  emphasis,
  locked,
  statusLabel,
  children
}: {
  label: string;
  className?: string;
  tooltip?: string;
  helper?: string;
  optional?: boolean;
  emphasis?: "default" | "finance" | "timeline";
  locked?: boolean;
  statusLabel?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "space-y-2.5",
        emphasis === "finance" && "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4",
        emphasis === "finance" && locked && "border-[rgba(71,84,103,0.22)] bg-[var(--finance-lock-surface)]",
        emphasis === "timeline" && "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-[13px] font-medium text-[var(--foreground)]">
            {label}
            {optional ? <> <OptionalLabelText /></> : null}
          </Label>
          {tooltip ? (
            <span title={tooltip}>
              <Info className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            </span>
          ) : null}
        </div>
        {statusLabel ? <Badge tone={locked ? "lock" : "slate"}>{statusLabel}</Badge> : null}
      </div>
      {children}
      {helper ? <p className="text-[12px] leading-5 text-[var(--muted-foreground)]">{helper}</p> : null}
    </div>
  );
}

function OptionalLabelText() {
  return (
    <span className="text-[11px] font-normal text-[var(--muted-foreground)]">
      (optional)
    </span>
  );
}

function WizardStepIndicator({
  currentStep,
  steps,
}: {
  currentStep: WizardStepId;
  steps: Array<{ id: WizardStepId; title: string }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {steps.map((step) => {
        const isActive = step.id === currentStep;
        const isComplete = step.id < currentStep;

        return (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-3 rounded-full border px-4 py-3 text-sm font-medium transition",
              isActive
                ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                : isComplete
                  ? "border-[var(--primary)] bg-white text-[var(--foreground)]"
                  : "border-[var(--border)] bg-[var(--muted)]/35 text-[var(--muted-foreground)]"
            )}
          >
            <span
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                isActive
                  ? "bg-white/20 text-white"
                  : isComplete
                    ? "bg-[var(--primary)] text-white"
                    : "bg-white text-[var(--muted-foreground)]"
              )}
            >
              {isComplete ? <Check className="h-3.5 w-3.5" /> : step.id}
            </span>
            <span>{step.title}</span>
          </div>
        );
      })}
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
    <section className="space-y-6 rounded-[28px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(248,250,252,0.7),#ffffff)] p-6 md:p-7">
      <div className="border-b border-[var(--border)] pb-5">
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-[var(--foreground)]">{title}</h3>
        <p className="mt-1 max-w-3xl text-[13px] leading-6 text-[var(--muted-foreground)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SectionLabel({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">{title}</p>
      <p className="text-[13px] leading-6 text-[var(--muted-foreground)]">{description}</p>
    </div>
  );
}

function SubsectionPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/18 p-4 md:p-5">
      <SectionLabel title={title} description={description} />
      {children}
    </div>
  );
}

function SummaryMetric({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`rounded-2xl border border-[var(--border)] p-4 ${muted ? "bg-[var(--muted)]/35" : "bg-[var(--muted)]/45"}`}>
      <p className="text-[11px] text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-[1.15rem] font-semibold tracking-[-0.02em]">{value}</p>
    </div>
  );
}

function SummaryGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">{title}</p>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 px-3 py-3">
      <span className="text-[13px] text-[var(--muted-foreground)]">{label}</span>
      <div className="text-right text-[13px] font-semibold text-[var(--foreground)]">{value}</div>
    </div>
  );
}

function InlineCalculationCue({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/65 p-4">
      <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-base font-semibold tracking-[-0.02em] text-[var(--foreground)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{detail}</p>
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

function toDateValue(value?: string | Date) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function getApprovalStatusLabel({
  isCreateMode,
  hasPendingRequest,
  approvalCount,
}: {
  isCreateMode: boolean;
  hasPendingRequest: boolean;
  approvalCount: number;
}) {
  if (isCreateMode) {
    return "Workflow starts after save";
  }

  if (hasPendingRequest) {
    return "Pending approval";
  }

  if (approvalCount > 0) {
    return `${approvalCount} recorded decision${approvalCount === 1 ? "" : "s"}`;
  }

  return "No approval history yet";
}
