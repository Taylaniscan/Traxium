"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, FileStack, MessageSquareText, PackageSearch, ShieldCheck, Users } from "lucide-react";
import { ApprovalPanel } from "@/components/saving-cards/approval-panel";
import { CreatableMasterDataField, type CreatableValue } from "@/components/saving-cards/creatable-master-data-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { currencies, phaseLabels, roleLabels } from "@/lib/constants";
import { formatCurrency, formatPlainNumber } from "@/lib/utils/numberFormatter";
import type { SavingCardWithRelations } from "@/lib/types";

type ReferenceData = Awaited<ReturnType<typeof import("@/lib/data").getReferenceData>>;

type SupplierForm = {
  supplier: CreatableValue;
  country: string;
  quotedPrice: string;
  currency: "EUR" | "USD";
  leadTimeDays: string;
  moq: string;
  paymentTerms: string;
  qualityRating: string;
  riskLevel: string;
  notes: string;
  isSelected: boolean;
};

type MaterialForm = {
  material: CreatableValue;
  supplier: CreatableValue;
  specification: string;
  quotedPrice: string;
  currency: "EUR" | "USD";
  performanceImpact: string;
  qualificationStatus: string;
  riskLevel: string;
  notes: string;
  isSelected: boolean;
};

const tabs = [
  { id: "overview", label: "Overview", icon: PackageSearch },
  { id: "financials", label: "Financials", icon: CheckCircle2 },
  { id: "stakeholders", label: "Stakeholders", icon: Users },
  { id: "evidence", label: "Evidence", icon: FileStack },
  { id: "alternative-suppliers", label: "Alternative Suppliers", icon: PackageSearch },
  { id: "alternative-materials", label: "Alternative Materials", icon: PackageSearch },
  { id: "validation", label: "Validation", icon: ShieldCheck },
  { id: "comments", label: "Comments", icon: MessageSquareText }
] as const;

export function SavingCardDetailWorkspace({
  card,
  referenceData,
  canApprove,
  canLock,
  currentUserId
}: {
  card: SavingCardWithRelations;
  referenceData: ReferenceData;
  canApprove: boolean;
  canLock: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("overview");
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplierForm());
  const [materialForm, setMaterialForm] = useState<MaterialForm>(emptyMaterialForm());
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const baselineEntries = [
    { label: "Baseline Supplier", value: `${card.supplier.name} · ${formatCurrency(card.baselinePrice, card.currency)}` },
    { label: "Baseline Material", value: card.material.name },
    { label: "Alternative Supplier", value: card.alternativeSupplier?.name ?? card.alternativeSupplierManualName ?? "Not specified" },
    { label: "Alternative Material", value: card.alternativeMaterial?.name ?? card.alternativeMaterialManualName ?? "Not specified" },
    { label: "Current Saving Card New Price", value: formatCurrency(card.newPrice, card.currency) }
  ];

  const comparisonOptions = [
    ...card.alternativeSuppliers.map((item) => ({
      label: item.supplier?.name ?? item.supplierNameManual ?? "Alternative supplier",
      type: "Supplier",
      price: item.quotedPrice,
      currency: item.currency,
      selected: item.isSelected
    })),
    ...card.alternativeMaterials.map((item) => ({
      label: item.material?.name ?? item.materialNameManual ?? "Alternative material",
      type: "Material",
      price: item.quotedPrice,
      currency: item.currency,
      selected: item.isSelected
    }))
  ];
  const bestOption = [...comparisonOptions].sort((a, b) => a.price - b.price)[0];

  async function submitAlternativeSupplier() {
    setError(null);
    const payload = {
      supplier: { id: supplierForm.supplier.mode === "existing" ? supplierForm.supplier.id : undefined, name: supplierForm.supplier.name },
      country: supplierForm.country,
      quotedPrice: supplierForm.quotedPrice,
      currency: supplierForm.currency,
      leadTimeDays: supplierForm.leadTimeDays,
      moq: supplierForm.moq,
      paymentTerms: supplierForm.paymentTerms,
      qualityRating: supplierForm.qualityRating,
      riskLevel: supplierForm.riskLevel,
      notes: supplierForm.notes,
      isSelected: supplierForm.isSelected
    };
    const endpoint = editingSupplierId
      ? `/api/saving-cards/${card.id}/alternative-suppliers/${editingSupplierId}`
      : `/api/saving-cards/${card.id}/alternative-suppliers`;
    const method = editingSupplierId ? "PUT" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error ?? "Unable to save alternative supplier.");
      return;
    }
    setSupplierForm(emptySupplierForm());
    setEditingSupplierId(null);
    router.refresh();
  }

  async function submitAlternativeMaterial() {
    setError(null);
    const payload = {
      material: { id: materialForm.material.mode === "existing" ? materialForm.material.id : undefined, name: materialForm.material.name },
      supplier: { id: materialForm.supplier.mode === "existing" ? materialForm.supplier.id : undefined, name: materialForm.supplier.name },
      specification: materialForm.specification,
      quotedPrice: materialForm.quotedPrice,
      currency: materialForm.currency,
      performanceImpact: materialForm.performanceImpact,
      qualificationStatus: materialForm.qualificationStatus,
      riskLevel: materialForm.riskLevel,
      notes: materialForm.notes,
      isSelected: materialForm.isSelected
    };
    const endpoint = editingMaterialId
      ? `/api/saving-cards/${card.id}/alternative-materials/${editingMaterialId}`
      : `/api/saving-cards/${card.id}/alternative-materials`;
    const method = editingMaterialId ? "PUT" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error ?? "Unable to save alternative material.");
      return;
    }
    setMaterialForm(emptyMaterialForm());
    setEditingMaterialId(null);
    router.refresh();
  }

  async function deleteEntry(endpoint: string) {
    setError(null);
    const response = await fetch(endpoint, { method: "DELETE" });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error ?? "Unable to delete entry.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sourcing Scenario Comparison</CardTitle>
          <CardDescription>Benchmark the baseline against evaluated supplier and material options.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
          <div className="space-y-3">
            {baselineEntries.map((item) => (
              <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/45 p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{item.label}</p>
                <p className="mt-1 text-sm font-semibold">{item.value}</p>
              </div>
            ))}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-700">Best Price Option</p>
              <p className="mt-1 text-sm font-semibold text-emerald-900">
                {bestOption ? `${bestOption.type}: ${bestOption.label} · ${formatCurrency(bestOption.price, bestOption.currency)}` : "No alternatives yet"}
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {comparisonOptions.length ? (
              comparisonOptions.map((option) => (
                <div key={`${option.type}-${option.label}-${option.price}`} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{option.label}</p>
                    {option.selected ? <Badge tone="emerald">Selected</Badge> : <Badge tone="slate">{option.type}</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                    {formatCurrency(option.price, option.currency)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-[var(--muted)] p-4 text-sm text-[var(--muted-foreground)]">
                Add supplier or material alternatives to compare sourcing scenarios.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm"
                  : "border-[var(--border)] bg-white text-[var(--foreground)] hover:border-blue-200 hover:bg-blue-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {activeTab === "overview" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>Core commercial and sourcing case context.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Metric label="Baseline Supplier" value={card.supplier.name} />
              <Metric label="Baseline Material" value={card.material.name} />
              <Metric label="Alternative Supplier" value={card.alternativeSupplier?.name ?? card.alternativeSupplierManualName ?? "Not specified"} />
              <Metric label="Alternative Material" value={card.alternativeMaterial?.name ?? card.alternativeMaterialManualName ?? "Not specified"} />
              <Metric label="Phase" value={phaseLabels[card.phase]} />
              <Metric label="Saving Type" value={card.savingType} />
              <Metric label="Business Unit" value={card.businessUnit.name} />
              <Metric label="Plant" value={card.plant.name} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Project Attributes</CardTitle>
              <CardDescription>Initiative classification, delivery effort, and validation readiness.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Metric label="Saving Driver" value={card.savingDriver ?? "Not set"} />
              <Metric label="Implementation Complexity" value={card.implementationComplexity ?? "Not set"} />
              <Metric label="Qualification Status" value={card.qualificationStatus ?? "Not set"} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "financials" ? (
        <Card>
          <CardHeader>
            <CardTitle>Financials</CardTitle>
            <CardDescription>Calculation inputs and baseline-versus-alternative scenario context on the card.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Baseline Price" value={formatCurrency(card.baselinePrice, card.currency)} />
            <Metric label="New Price" value={formatCurrency(card.newPrice, card.currency)} />
            <Metric label="Annual Volume" value={formatPlainNumber(card.annualVolume)} />
            <Metric label="Calculated Savings" value={formatCurrency(Math.round(card.calculatedSavings), "EUR")} />
            <Metric
              label="Alternative Scenario"
              value={
                card.alternativeSupplier?.name ??
                card.alternativeSupplierManualName ??
                card.alternativeMaterial?.name ??
                card.alternativeMaterialManualName ??
                "No alternative selected"
              }
            />
            <Metric
              label="Scenario Comparison"
              value={`Baseline ${formatCurrency(card.baselinePrice, card.currency)} vs New ${formatCurrency(card.newPrice, card.currency)}`}
            />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "stakeholders" ? (
        <Card>
          <CardHeader>
            <CardTitle>Stakeholders</CardTitle>
            <CardDescription>People involved in the sourcing workflow and governance process.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {card.stakeholders.map((stakeholder) => (
              <div key={stakeholder.id} className="rounded-2xl bg-[var(--muted)] p-4">
                <p className="font-semibold">{stakeholder.user.name}</p>
                <p className="text-sm text-[var(--muted-foreground)]">{roleLabels[stakeholder.user.role]}</p>
                <p className="text-sm text-[var(--muted-foreground)]">{stakeholder.user.email}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "evidence" ? (
  <Card className="rounded-3xl border border-[var(--border)] shadow-sm">
    <CardHeader>
      <CardTitle>Evidence</CardTitle>
      <CardDescription>
        Files supporting sourcing negotiations and finance validation.
      </CardDescription>
    </CardHeader>

    <CardContent className="space-y-3">
      {card.evidence.length ? (
        card.evidence.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
          >
            <div>
              <div className="text-sm font-medium">{item.fileName}</div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {item.fileType}
              </div>
            </div>

            <a
              href={`/api/evidence/${item.id}/download`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline"
            >
              Open file
            </a>
          </div>
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/60 px-4 py-6 text-sm text-[var(--muted-foreground)]">
          No evidence uploaded yet.
        </div>
      )}
    </CardContent>
  </Card>
) : null}

      {activeTab === "alternative-suppliers" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Alternative Suppliers</CardTitle>
              <CardDescription>Track evaluated suppliers, compare sourcing terms, and mark the winning supplier.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <CreatableMasterDataField
                label="Supplier"
                items={referenceData.suppliers}
                value={supplierForm.supplier}
                onChange={(supplier) => setSupplierForm({ ...supplierForm, supplier })}
              />
              <Field label="Country">
                <Input value={supplierForm.country} onChange={(event) => setSupplierForm({ ...supplierForm, country: event.target.value })} />
              </Field>
              <Field label="Quoted Price">
                <Input value={supplierForm.quotedPrice} onChange={(event) => setSupplierForm({ ...supplierForm, quotedPrice: event.target.value })} type="number" step="0.01" />
              </Field>
              <Field label="Currency">
                <Select value={supplierForm.currency} onChange={(event) => setSupplierForm({ ...supplierForm, currency: event.target.value as "EUR" | "USD" })}>
                  {currencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Lead Time (days)">
                <Input value={supplierForm.leadTimeDays} onChange={(event) => setSupplierForm({ ...supplierForm, leadTimeDays: event.target.value })} type="number" />
              </Field>
              <Field label="MOQ">
                <Input value={supplierForm.moq} onChange={(event) => setSupplierForm({ ...supplierForm, moq: event.target.value })} type="number" />
              </Field>
              <Field label="Payment Terms">
                <Input value={supplierForm.paymentTerms} onChange={(event) => setSupplierForm({ ...supplierForm, paymentTerms: event.target.value })} />
              </Field>
              <Field label="Quality Rating">
                <Input value={supplierForm.qualityRating} onChange={(event) => setSupplierForm({ ...supplierForm, qualityRating: event.target.value })} />
              </Field>
              <Field label="Risk Level">
                <Input value={supplierForm.riskLevel} onChange={(event) => setSupplierForm({ ...supplierForm, riskLevel: event.target.value })} />
              </Field>
              <Field label="Notes" className="md:col-span-2 xl:col-span-3">
                <Textarea value={supplierForm.notes} onChange={(event) => setSupplierForm({ ...supplierForm, notes: event.target.value })} />
              </Field>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={supplierForm.isSelected}
                  onChange={(event) => setSupplierForm({ ...supplierForm, isSelected: event.target.checked })}
                />
                Mark as selected supplier
              </label>
              <div className="flex gap-3">
                <Button type="button" onClick={submitAlternativeSupplier}>
                  {editingSupplierId ? "Update Alternative Supplier" : "Add Alternative Supplier"}
                </Button>
                {editingSupplierId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingSupplierId(null);
                      setSupplierForm(emptySupplierForm());
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="min-w-full text-sm">
                <thead className="border-b bg-white/70">
                  <tr>
                    {["Supplier Name", "Country", "Quoted Price", "Currency", "Lead Time", "MOQ", "Payment Terms", "Quality Rating", "Risk Level", "Notes", "Selected Supplier", "Actions"].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-left font-semibold text-[var(--muted-foreground)]">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {card.alternativeSuppliers.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="px-4 py-3">{item.supplier?.name ?? item.supplierNameManual}</td>
                      <td className="px-4 py-3">{item.country}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.quotedPrice, item.currency)}</td>
                      <td className="px-4 py-3">{item.currency}</td>
                      <td className="px-4 py-3">{item.leadTimeDays}</td>
                      <td className="px-4 py-3">{item.moq}</td>
                      <td className="px-4 py-3">{item.paymentTerms}</td>
                      <td className="px-4 py-3">{item.qualityRating}</td>
                      <td className="px-4 py-3">{item.riskLevel}</td>
                      <td className="px-4 py-3">{item.notes || "-"}</td>
                      <td className="px-4 py-3">{item.isSelected ? "Yes" : "No"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button type="button" variant="ghost" onClick={() => {
                            setEditingSupplierId(item.id);
                            setSupplierForm({
                              supplier: {
                                id: item.supplierId ?? undefined,
                                name: item.supplier?.name ?? item.supplierNameManual ?? "",
                                mode: item.supplierId ? "existing" : "new"
                              },
                              country: item.country,
                              quotedPrice: String(item.quotedPrice),
                              currency: item.currency,
                              leadTimeDays: String(item.leadTimeDays),
                              moq: String(item.moq),
                              paymentTerms: item.paymentTerms,
                              qualityRating: item.qualityRating,
                              riskLevel: item.riskLevel,
                              notes: item.notes ?? "",
                              isSelected: item.isSelected
                            });
                          }}>
                            Edit
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => deleteEntry(`/api/saving-cards/${card.id}/alternative-suppliers/${item.id}`)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "alternative-materials" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Alternative Materials</CardTitle>
              <CardDescription>Track material substitutions, supplier pairings, and qualification outcomes.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <CreatableMasterDataField
                label="Material"
                items={referenceData.materials}
                value={materialForm.material}
                onChange={(material) => setMaterialForm({ ...materialForm, material })}
              />
              <CreatableMasterDataField
                label="Supplier"
                items={referenceData.suppliers}
                value={materialForm.supplier}
                onChange={(supplier) => setMaterialForm({ ...materialForm, supplier })}
              />
              <Field label="Specification">
                <Input value={materialForm.specification} onChange={(event) => setMaterialForm({ ...materialForm, specification: event.target.value })} />
              </Field>
              <Field label="Quoted Price">
                <Input value={materialForm.quotedPrice} onChange={(event) => setMaterialForm({ ...materialForm, quotedPrice: event.target.value })} type="number" step="0.01" />
              </Field>
              <Field label="Currency">
                <Select value={materialForm.currency} onChange={(event) => setMaterialForm({ ...materialForm, currency: event.target.value as "EUR" | "USD" })}>
                  {currencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Performance Impact">
                <Input value={materialForm.performanceImpact} onChange={(event) => setMaterialForm({ ...materialForm, performanceImpact: event.target.value })} />
              </Field>
              <Field label="Qualification Status">
                <Input value={materialForm.qualificationStatus} onChange={(event) => setMaterialForm({ ...materialForm, qualificationStatus: event.target.value })} />
              </Field>
              <Field label="Risk Level">
                <Input value={materialForm.riskLevel} onChange={(event) => setMaterialForm({ ...materialForm, riskLevel: event.target.value })} />
              </Field>
              <Field label="Notes" className="md:col-span-2 xl:col-span-3">
                <Textarea value={materialForm.notes} onChange={(event) => setMaterialForm({ ...materialForm, notes: event.target.value })} />
              </Field>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={materialForm.isSelected}
                  onChange={(event) => setMaterialForm({ ...materialForm, isSelected: event.target.checked })}
                />
                Mark as selected material
              </label>
              <div className="flex gap-3">
                <Button type="button" onClick={submitAlternativeMaterial}>
                  {editingMaterialId ? "Update Alternative Material" : "Add Alternative Material"}
                </Button>
                {editingMaterialId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingMaterialId(null);
                      setMaterialForm(emptyMaterialForm());
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="min-w-full text-sm">
                <thead className="border-b bg-white/70">
                  <tr>
                    {["Material Name", "Supplier", "Specification", "Quoted Price", "Currency", "Performance Impact", "Qualification Status", "Risk Level", "Notes", "Selected Material", "Actions"].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-left font-semibold text-[var(--muted-foreground)]">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {card.alternativeMaterials.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="px-4 py-3">{item.material?.name ?? item.materialNameManual}</td>
                      <td className="px-4 py-3">{item.supplier?.name ?? item.supplierNameManual ?? "-"}</td>
                      <td className="px-4 py-3">{item.specification}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.quotedPrice, item.currency)}</td>
                      <td className="px-4 py-3">{item.currency}</td>
                      <td className="px-4 py-3">{item.performanceImpact}</td>
                      <td className="px-4 py-3">{item.qualificationStatus}</td>
                      <td className="px-4 py-3">{item.riskLevel}</td>
                      <td className="px-4 py-3">{item.notes || "-"}</td>
                      <td className="px-4 py-3">{item.isSelected ? "Yes" : "No"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button type="button" variant="ghost" onClick={() => {
                            setEditingMaterialId(item.id);
                            setMaterialForm({
                              material: {
                                id: item.materialId ?? undefined,
                                name: item.material?.name ?? item.materialNameManual ?? "",
                                mode: item.materialId ? "existing" : "new"
                              },
                              supplier: {
                                id: item.supplierId ?? undefined,
                                name: item.supplier?.name ?? item.supplierNameManual ?? "",
                                mode: item.supplierId ? "existing" : "new"
                              },
                              specification: item.specification,
                              quotedPrice: String(item.quotedPrice),
                              currency: item.currency,
                              performanceImpact: item.performanceImpact,
                              qualificationStatus: item.qualificationStatus,
                              riskLevel: item.riskLevel,
                              notes: item.notes ?? "",
                              isSelected: item.isSelected
                            });
                          }}>
                            Edit
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => deleteEntry(`/api/saving-cards/${card.id}/alternative-materials/${item.id}`)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "validation" ? (
        <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
          <ApprovalPanel card={card} canApprove={canApprove} canLock={canLock} currentUserId={currentUserId} />
          <Card>
            <CardHeader>
              <CardTitle>Validation History</CardTitle>
              <CardDescription>Approvals and phase progression for finance and procurement governance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {card.phaseChangeRequests.map((request) => (
                <div key={request.id} className="rounded-2xl border bg-white p-4">
                  <p className="font-semibold">
                    {phaseLabels[request.currentPhase]} to {phaseLabels[request.requestedPhase]} · {request.approvalStatus.toLowerCase()}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Requested by {request.requestedBy.name} on {formatDate(request.createdAt)}
                  </p>
                </div>
              ))}
              {card.approvals.map((approval) => (
                <div key={approval.id} className="rounded-2xl bg-[var(--muted)] p-4">
                  <p className="font-semibold">
                    {phaseLabels[approval.phase]} · {approval.approver.name}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">{approval.comment ?? "No comment"}</p>
                </div>
              ))}
              {card.phaseHistory.map((item) => (
                <div key={item.id} className="rounded-2xl border bg-white p-4">
                  <p className="font-semibold">
                    {item.fromPhase ? phaseLabels[item.fromPhase] : "Created"} to {phaseLabels[item.toPhase]}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">{formatDate(item.createdAt)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "comments" ? (
        <Card>
          <CardHeader>
            <CardTitle>Comments</CardTitle>
            <CardDescription>Discussion log for procurement, finance, and project stakeholders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {card.comments.length ? (
              card.comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl bg-[var(--muted)] p-4">
                  <p className="font-semibold">{comment.author.name}</p>
                  <p className="mt-1 text-sm">{comment.body}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">No comments recorded for this saving card yet.</p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-2 block">{label}</Label>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--muted)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function emptySupplierForm(): SupplierForm {
  return {
    supplier: { mode: "existing", id: undefined, name: "" },
    country: "",
    quotedPrice: "",
    currency: "EUR",
    leadTimeDays: "",
    moq: "",
    paymentTerms: "",
    qualityRating: "",
    riskLevel: "",
    notes: "",
    isSelected: false
  };
}

function emptyMaterialForm(): MaterialForm {
  return {
    material: { mode: "existing", id: undefined, name: "" },
    supplier: { mode: "existing", id: undefined, name: "" },
    specification: "",
    quotedPrice: "",
    currency: "EUR",
    performanceImpact: "",
    qualificationStatus: "",
    riskLevel: "",
    notes: "",
    isSelected: false
  };
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(date));
}
