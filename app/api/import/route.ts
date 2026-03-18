import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getReferenceData, importSavingCards } from "@/lib/data";
import { savingCardSchema } from "@/lib/validation";

function normalizeRow(
  row: Record<string, unknown>,
  referenceData: Awaited<ReturnType<typeof getReferenceData>>
) {
  const resolveId = (collection: Array<{ id: string; name: string }>, columnName: string) => {
    const match = collection.find((item) => item.name === row[columnName]);
    return match?.id ?? "";
  };

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
    buyer: { id: resolveId(referenceData.buyers, "Buyer"), name: String(row.Buyer ?? "") },
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
    evidence: [],
  };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Request body must be valid form data." }, { status: 400 });
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "An import file is required." }, { status: 422 });
    }

    if (!file.size) {
      return NextResponse.json({ error: "The uploaded file is empty." }, { status: 422 });
    }

    const arrayBuffer = await file.arrayBuffer();
    let workbook: XLSX.WorkBook;

    try {
      workbook = XLSX.read(arrayBuffer, { type: "array" });
    } catch {
      return NextResponse.json(
        { error: "Uploaded file must be a valid Excel workbook." },
        { status: 400 }
      );
    }

    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return NextResponse.json(
        { error: "The workbook does not contain any sheets." },
        { status: 422 }
      );
    }

    const worksheet = workbook.Sheets[firstSheetName];

    if (!worksheet) {
      return NextResponse.json(
        { error: "The workbook could not be read." },
        { status: 400 }
      );
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

    if (!rows.length) {
      return NextResponse.json(
        { error: "The workbook does not contain any import rows." },
        { status: 422 }
      );
    }

    const referenceData = await getReferenceData(user.organizationId);
    const normalized = rows.map((row) => normalizeRow(row, referenceData));

    for (const [index, row] of normalized.entries()) {
      const validation = savingCardSchema.safeParse(row);

      if (!validation.success) {
        const issue = validation.error.issues[0];
        return NextResponse.json(
          {
            error: `Row ${index + 2}: ${issue?.message ?? "Import row is invalid."}`,
          },
          { status: 422 }
        );
      }
    }

    await importSavingCards(normalized, user.id, user.organizationId);

    return NextResponse.json({ count: normalized.length });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Import payload is invalid." },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status: 500 }
    );
  }
}
