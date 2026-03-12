import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getReferenceData, importSavingCards } from "@/lib/data";

function normalizeRow(row: Record<string, unknown>, referenceData: Awaited<ReturnType<typeof getReferenceData>>) {
  const resolveId = (collection: Array<{ id: string; name: string }>, key: string) => {
    const match = collection.find((item) => item.name === row[key]);
    return match?.id ?? "";
  };

  const buyer = referenceData.users.find((item) => item.name === row.Buyer);

  return {
    title: row.Title,
    description: row.Description ?? `${row.Title} imported from Excel`,
    savingType: row.SavingType ?? "Imported",
    phase: row.Phase ?? "IDEA",
    supplier: { id: resolveId(referenceData.suppliers, "Supplier"), name: String(row.Supplier ?? "") },
    material: { id: resolveId(referenceData.materials, "Material"), name: String(row.Material ?? "") },
    category: { id: resolveId(referenceData.categories, "Category"), name: String(row.Category ?? "") },
    plant: { id: resolveId(referenceData.plants, "Plant"), name: String(row.Plant ?? "") },
    businessUnit: { id: resolveId(referenceData.businessUnits, "BusinessUnit"), name: String(row.BusinessUnit ?? "") },
    buyer: { id: buyer?.id ?? "", name: String(row.Buyer ?? "") },
    baselinePrice: row.BaselinePrice,
    newPrice: row.NewPrice,
    annualVolume: row.AnnualVolume,
    currency: row.Currency ?? "EUR",
    fxRate: row.FxRate ?? 1,
    frequency: row.Frequency ?? "RECURRING",
    startDate: row.StartDate,
    endDate: row.EndDate,
    impactStartDate: row.ImpactStartDate ?? row.StartDate,
    impactEndDate: row.ImpactEndDate ?? row.EndDate,
    cancellationReason: row.CancellationReason ?? "",
    stakeholderIds: [],
    evidence: []
  };
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file received." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
    const referenceData = await getReferenceData();
    const normalized = rows.map((row) => normalizeRow(row, referenceData));

    await importSavingCards(normalized, user.id);

    return NextResponse.json({ count: normalized.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed." }, { status: 400 });
  }
}
