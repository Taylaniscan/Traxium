import { UsageFeature, UsageWindow } from "@prisma/client";
import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createAuthGuardErrorResponse, requireOrganization } from "@/lib/auth";
import { getReferenceData, importSavingCards } from "@/lib/data";
import { canManageOrganizationMembers } from "@/lib/organizations";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  createRateLimitErrorResponse,
  enforceRateLimit,
  RateLimitExceededError,
} from "@/lib/rate-limit";
import {
  enforceUsageQuota,
  recordUsageEvent,
  UsageQuotaExceededError,
} from "@/lib/usage";
import { savingCardSchema } from "@/lib/validation";
import {
  MASTER_DATA_IMPORT_ENTITY_KEYS,
  type MasterDataImportEntityKey,
} from "@/lib/onboarding/master-data-config";
import { phaseLabels, phases } from "@/lib/constants";

const IMPORT_QUOTA_WINDOW = UsageWindow.MONTH;
const MASTER_DATA_IMPORT_TYPES = MASTER_DATA_IMPORT_ENTITY_KEYS;

type MasterDataImportType = MasterDataImportEntityKey;
type ImportType = MasterDataImportType | "saving_cards";
type MasterDataImportStatus = "created" | "skipped" | "failed";
type SavingCardImportStatus = "valid" | "failed";

type MasterDataImportResult = {
  row: number;
  status: MasterDataImportStatus;
  name: string;
  message: string;
};

type MasterDataImportResponse = {
  importType: MasterDataImportType;
  summary: {
    created: number;
    skipped: number;
    failed: number;
  };
  results: MasterDataImportResult[];
};

type SavingCardImportResult = {
  row: number;
  status: SavingCardImportStatus;
  title: string;
  message: string;
};

type SavingCardImportErrorResponse = {
  importType: "saving_cards";
  error: string;
  summary: {
    total: number;
    valid: number;
    failed: number;
  };
  results: SavingCardImportResult[];
};

type ValidatedMasterDataImportRow = {
  name: string;
  email?: string;
  code?: string;
  department?: string;
  country?: string;
  contactEmail?: string;
  description?: string;
  unitOfMeasure?: string;
  owner?: string;
};

class ImportFileError extends Error {
  constructor(
    message: string,
    readonly status = 422
  ) {
    super(message);
    this.name = "ImportFileError";
  }
}

const MASTER_DATA_IMPORT_EXTENSIONS = new Set([".csv", ".xlsx"]);
const phaseImportAliases = new Map<string, (typeof phases)[number]>(
  phases.flatMap((phase) => [
    [normalizeImportKey(phase), phase],
    [normalizeImportKey(phaseLabels[phase]), phase],
  ])
);

phaseImportAliases.set("realised", "REALISED");
phaseImportAliases.set("cancelled", "CANCELLED");

function normalizeRow(
  row: Record<string, unknown>,
  referenceData: Awaited<ReturnType<typeof getReferenceData>>
) {
  const getCell = (...columnNames: string[]) => {
    for (const columnName of columnNames) {
      if (Object.hasOwn(row, columnName)) {
        return row[columnName];
      }
    }

    const normalizedRow = normalizeImportRow(row);

    for (const columnName of columnNames) {
      const normalizedKey = normalizeImportKey(columnName);

      if (Object.hasOwn(normalizedRow, normalizedKey)) {
        return normalizedRow[normalizedKey];
      }
    }

    return undefined;
  };
  const resolveId = (
    collection: Array<{ id: string; name: string }>,
    ...columnNames: string[]
  ) => {
    const rawValue = getCell(...columnNames);
    const normalizedValue = normalizeImportCell(rawValue);
    const match = collection.find(
      (item) => normalizeImportKey(item.name) === normalizeImportKey(normalizedValue)
    );
    return match?.id ?? "";
  };
  const rawPhase = normalizeImportCell(getCell("Phase"));
  const normalizedPhase =
    phaseImportAliases.get(normalizeImportKey(rawPhase)) ?? "IDEA";

  return {
    title: getCell("Title", "Saving Card Title"),
    description:
      getCell("Description") ??
      `${getCell("Title", "Saving Card Title") ?? "Saving card"} imported from Excel`,
    savingType: getCell("SavingType", "Saving Type") ?? "Imported",
    phase: normalizedPhase,
    supplier: {
      id: resolveId(referenceData.suppliers, "Supplier"),
      name: normalizeImportCell(getCell("Supplier")),
    },
    material: {
      id: resolveId(referenceData.materials, "Material"),
      name: normalizeImportCell(getCell("Material")),
    },
    category: {
      id: resolveId(referenceData.categories, "Category"),
      name: normalizeImportCell(getCell("Category")),
    },
    plant: {
      id: resolveId(referenceData.plants, "Plant"),
      name: normalizeImportCell(getCell("Plant")),
    },
    businessUnit: {
      id: resolveId(referenceData.businessUnits, "BusinessUnit", "Business Unit"),
      name: normalizeImportCell(getCell("BusinessUnit", "Business Unit")),
    },
    buyer: {
      id: resolveId(referenceData.buyers, "Buyer"),
      name: normalizeImportCell(getCell("Buyer")),
    },
    baselinePrice: getCell("BaselinePrice", "Baseline Price"),
    newPrice: getCell("NewPrice", "New Price"),
    annualVolume: getCell("AnnualVolume", "Annual Volume"),
    currency: getCell("Currency") ?? "EUR",
    fxRate: getCell("FxRate", "FX Rate") ?? 1,
    frequency: getCell("Frequency") ?? "RECURRING",
    startDate: getCell("StartDate", "Start Date"),
    endDate: getCell("EndDate", "End Date"),
    impactStartDate:
      getCell("ImpactStartDate", "Impact Start Date") ??
      getCell("StartDate", "Start Date"),
    impactEndDate:
      getCell("ImpactEndDate", "Impact End Date") ??
      getCell("EndDate", "End Date"),
    cancellationReason: getCell("CancellationReason", "Cancellation Reason") ?? "",
    stakeholderIds: [],
    evidence: [],
  };
}

function parseImportType(value: FormDataEntryValue | null): ImportType | null {
  if (value == null || value === "" || value === "saving_cards") {
    return "saving_cards";
  }

  if (typeof value !== "string") {
    return null;
  }

  return MASTER_DATA_IMPORT_TYPES.includes(value as MasterDataImportType)
    ? (value as MasterDataImportType)
    : null;
}

function getImportRateLimitAction(importType: ImportType) {
  return importType === "saving_cards"
    ? "saving-cards.import"
    : `master-data.import.${importType}`;
}

function normalizeImportCell(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function normalizeImportKey(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function normalizeImportRow(
  row: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeImportKey(key), value])
  );
}

function createImportResult(
  row: number,
  status: MasterDataImportStatus,
  name: string,
  message: string
): MasterDataImportResult {
  return {
    row,
    status,
    name,
    message,
  };
}

function createSavingCardImportResult(
  row: number,
  status: SavingCardImportStatus,
  title: string,
  message: string
): SavingCardImportResult {
  return {
    row,
    status,
    title,
    message,
  };
}

function getSavingCardImportFieldLabel(path: PropertyKey[]) {
  const field = path[0];

  if (typeof field !== "string") {
    return "";
  }

  const labels: Record<string, string> = {
    title: "Title",
    description: "Description",
    savingType: "Saving Type",
    phase: "Phase",
    supplier: "Supplier",
    material: "Material",
    category: "Category",
    plant: "Plant",
    businessUnit: "Business Unit",
    buyer: "Buyer",
    baselinePrice: "Baseline Price",
    newPrice: "New Price",
    annualVolume: "Annual Volume",
    currency: "Currency",
    fxRate: "FX Rate",
    frequency: "Frequency",
    savingDriver: "Saving Driver",
    implementationComplexity: "Implementation Complexity",
    qualificationStatus: "Qualification Status",
    startDate: "Start Date",
    endDate: "End Date",
    impactStartDate: "Impact Start Date",
    impactEndDate: "Impact End Date",
    cancellationReason: "Cancellation Reason",
  };

  return labels[field] ?? field;
}

function formatSavingCardImportIssue(issue: z.ZodIssue) {
  const label = getSavingCardImportFieldLabel(issue.path);

  return label ? `${label}: ${issue.message}` : issue.message;
}

function validateSavingCardImportRows(
  rows: ReturnType<typeof normalizeRow>[]
): SavingCardImportErrorResponse | null {
  const results: SavingCardImportResult[] = [];

  for (const [index, row] of rows.entries()) {
    const validation = savingCardSchema.safeParse(row);

    if (validation.success) {
      results.push(
        createSavingCardImportResult(
          index + 2,
          "valid",
          normalizeImportCell(row.title),
          "Ready to import."
        )
      );
      continue;
    }

    results.push(
      createSavingCardImportResult(
        index + 2,
        "failed",
        normalizeImportCell(row.title),
        validation.error.issues.map(formatSavingCardImportIssue).join("; ")
      )
    );
  }

  const failed = results.filter((result) => result.status === "failed");

  if (!failed.length) {
    return null;
  }

  const failedCount = failed.length;
  const validCount = results.length - failedCount;

  return {
    importType: "saving_cards",
    error: `Saving-card import has ${failedCount} row error${failedCount === 1 ? "" : "s"}. No saving cards were imported. Fix the listed rows and retry.`,
    summary: {
      total: results.length,
      valid: validCount,
      failed: failedCount,
    },
    results: failed,
  };
}

function getMasterDataHeaderError(importType: MasterDataImportType) {
  switch (importType) {
    case "buyers":
      return "Buyer imports must include a Name column.";
    case "suppliers":
      return "Supplier imports must include a Name column.";
    case "materials":
      return "Material imports must include a Name column.";
    case "categories":
      return "Category imports must include a Name column.";
  }
}

function getMasterDataSingularLabel(importType: MasterDataImportType) {
  switch (importType) {
    case "buyers":
      return "buyer";
    case "suppliers":
      return "supplier";
    case "materials":
      return "material";
    case "categories":
      return "category";
  }
}

function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLocaleLowerCase("en-US");
  const lastDotIndex = normalized.lastIndexOf(".");

  if (lastDotIndex < 0) {
    return "";
  }

  return normalized.slice(lastDotIndex);
}

function validateMasterDataFileType(file: File) {
  const extension = getFileExtension(file.name);

  if (!MASTER_DATA_IMPORT_EXTENSIONS.has(extension)) {
    throw new ImportFileError(
      "Master-data imports accept CSV or XLSX files only."
    );
  }

  return extension;
}

async function readWorkbookFromUpload(file: File, importType: ImportType) {
  const extension = getFileExtension(file.name);

  try {
    if (importType !== "saving_cards" && extension === ".csv") {
      return XLSX.read(await file.text(), { type: "string" });
    }

    return XLSX.read(await file.arrayBuffer(), { type: "array" });
  } catch {
    throw new ImportFileError(
      importType === "saving_cards"
        ? "Uploaded file must be a valid Excel workbook."
        : "Uploaded file must be a valid CSV or XLSX file.",
      400
    );
  }
}

async function getExistingMasterDataNames(
  importType: MasterDataImportType,
  organizationId: string
) {
  switch (importType) {
    case "buyers": {
      const buyers = await prisma.buyer.findMany({
        where: { organizationId },
        select: { name: true },
      });
      return new Set(buyers.map((buyer) => normalizeImportKey(buyer.name)));
    }
    case "suppliers": {
      const suppliers = await prisma.supplier.findMany({
        where: { organizationId },
        select: { name: true },
      });
      return new Set(suppliers.map((supplier) => normalizeImportKey(supplier.name)));
    }
    case "materials": {
      const materials = await prisma.material.findMany({
        where: { organizationId },
        select: { name: true },
      });
      return new Set(materials.map((material) => normalizeImportKey(material.name)));
    }
    case "categories": {
      const categories = await prisma.category.findMany({
        where: { organizationId },
        select: { name: true },
      });
      return new Set(categories.map((category) => normalizeImportKey(category.name)));
    }
  }
}

async function createMasterDataRecord(
  importType: MasterDataImportType,
  organizationId: string,
  row: ValidatedMasterDataImportRow
) {
  switch (importType) {
    case "buyers":
      await prisma.buyer.create({
        data: {
          organizationId,
          name: row.name,
          email: row.email ? row.email : null,
        },
      });
      return;
    case "suppliers":
      await prisma.supplier.create({
        data: {
          organizationId,
          name: row.name,
        },
      });
      return;
    case "materials":
      await prisma.material.create({
        data: {
          organizationId,
          name: row.name,
        },
      });
      return;
    case "categories":
      await prisma.category.create({
        data: {
          organizationId,
          name: row.name,
          annualTarget: 0,
        },
      });
      return;
  }
}

function validateMasterDataRow(
  importType: MasterDataImportType,
  row: Record<string, unknown>
): { ok: true; value: ValidatedMasterDataImportRow } | { ok: false; message: string } {
  const name = normalizeImportCell(row.name);

  if (!name) {
    return {
      ok: false,
      message: "Name is required.",
    };
  }

  switch (importType) {
    case "buyers": {
      const email = normalizeImportCell(row.email);

      if (email) {
        const validation = z
          .string()
          .trim()
          .email("Email must be a valid email address.")
          .safeParse(email);

        if (!validation.success) {
          return {
            ok: false,
            message: validation.error.issues[0]?.message ?? "Email must be valid.",
          };
        }
      }

      return {
        ok: true,
        value: {
          name,
          email,
          code: normalizeImportCell(row.code),
          department: normalizeImportCell(row.department),
        },
      };
    }
    case "suppliers": {
      const contactEmail = normalizeImportCell(row.contactemail);

      if (contactEmail) {
        const validation = z
          .string()
          .trim()
          .email("Contact email must be a valid email address.")
          .safeParse(contactEmail);

        if (!validation.success) {
          return {
            ok: false,
            message:
              validation.error.issues[0]?.message ??
              "Contact email must be valid.",
          };
        }
      }

      return {
        ok: true,
        value: {
          name,
          code: normalizeImportCell(row.code),
          country: normalizeImportCell(row.country),
          contactEmail,
        },
      };
    }
    case "materials":
      return {
        ok: true,
        value: {
          name,
          code: normalizeImportCell(row.code),
          description: normalizeImportCell(row.description),
          unitOfMeasure: normalizeImportCell(row.unitofmeasure),
        },
      };
    case "categories":
      return {
        ok: true,
        value: {
          name,
          code: normalizeImportCell(row.code),
          owner: normalizeImportCell(row.owner),
        },
      };
  }
}

async function importMasterDataRows(
  importType: MasterDataImportType,
  rows: Record<string, unknown>[],
  organizationId: string
): Promise<MasterDataImportResponse> {
  const firstRow = rows[0] ? normalizeImportRow(rows[0]) : null;

  if (!firstRow || !Object.keys(firstRow).includes("name")) {
    throw new ZodError([
      {
        code: "custom",
        path: ["Name"],
        message: getMasterDataHeaderError(importType),
      },
    ]);
  }

  const existingNames = await getExistingMasterDataNames(importType, organizationId);
  const workbookNames = new Set<string>();
  const results: MasterDataImportResult[] = [];
  const summary = {
    created: 0,
    skipped: 0,
    failed: 0,
  };

  for (const [index, rawRow] of rows.entries()) {
    const rowNumber = index + 2;
    const row = normalizeImportRow(rawRow);
    const validation = validateMasterDataRow(importType, row);

    if (!validation.ok) {
      summary.failed += 1;
      results.push(
        createImportResult(
          rowNumber,
          "failed",
          normalizeImportCell(row.name),
          validation.message
        )
      );
      continue;
    }

    const validatedRow = validation.value;
    const name = validatedRow.name;

    const nameKey = normalizeImportKey(name);

    if (workbookNames.has(nameKey)) {
      summary.skipped += 1;
      results.push(
        createImportResult(
          rowNumber,
          "skipped",
          name,
          "Duplicate name already appears earlier in this workbook."
        )
      );
      continue;
    }

    if (existingNames.has(nameKey)) {
      summary.skipped += 1;
      results.push(
        createImportResult(
          rowNumber,
          "skipped",
          name,
          "Already exists in this workspace."
        )
      );
      continue;
    }

    try {
      // Buyers and suppliers currently persist only the fields supported by the
      // live master-data schema, while still accepting the onboarding template columns.
      await createMasterDataRecord(importType, organizationId, validatedRow);

      workbookNames.add(nameKey);
      existingNames.add(nameKey);
      summary.created += 1;
      results.push(
        createImportResult(
          rowNumber,
          "created",
          name,
          `Created ${getMasterDataSingularLabel(importType)} record.`
        )
      );
    } catch (error) {
      summary.failed += 1;
      results.push(
        createImportResult(
          rowNumber,
          "failed",
          name,
          error instanceof Error ? error.message : "Row import failed."
        )
      );
    }
  }

  return {
    importType,
    summary,
    results,
  };
}

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof requireOrganization>>;

  try {
    user = await requireOrganization({ redirectTo: null });
  } catch (error) {
    const response = createAuthGuardErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }

  if (
    !canManageOrganizationMembers(user.activeOrganization.membershipRole) &&
    !hasPermission(user.role, "manageWorkspace")
  ) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Request body must be valid form data." }, { status: 400 });
    }

    const importType = parseImportType(formData.get("importType"));

    if (!importType) {
      return NextResponse.json(
        { error: "Import type must be saving_cards, buyers, suppliers, materials, or categories." },
        { status: 422 }
      );
    }

    await enforceRateLimit({
      policy: "bulkImport",
      request,
      userId: user.id,
      organizationId: user.organizationId,
      action: getImportRateLimitAction(importType),
    });

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "An import file is required." }, { status: 422 });
    }

    if (!file.size) {
      return NextResponse.json({ error: "The uploaded file is empty." }, { status: 422 });
    }

    let workbook: XLSX.WorkBook;

    try {
      if (importType !== "saving_cards") {
        validateMasterDataFileType(file);
      }

      workbook = await readWorkbookFromUpload(file, importType);
    } catch (error) {
      if (error instanceof ImportFileError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      throw error;
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

    const rows =
      importType === "saving_cards"
        ? XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet)
        : XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
            defval: "",
          });

    if (!rows.length) {
      return NextResponse.json(
        { error: "The workbook does not contain any import rows." },
        { status: 422 }
      );
    }

    if (importType !== "saving_cards") {
      const result = await importMasterDataRows(importType, rows, user.organizationId);
      return NextResponse.json(result);
    }

    const referenceData = await getReferenceData(user.organizationId);
    const normalized = rows.map((row) => normalizeRow(row, referenceData));

    const validationErrorResponse = validateSavingCardImportRows(normalized);

    if (validationErrorResponse) {
      return NextResponse.json(validationErrorResponse, { status: 422 });
    }

    await enforceUsageQuota({
      organizationId: user.organizationId,
      feature: UsageFeature.SAVING_CARDS,
      window: IMPORT_QUOTA_WINDOW,
      requestedQuantity: normalized.length,
      message: "This import would exceed the saving card quota for the current period.",
    });

    await importSavingCards(normalized, user.id, user.organizationId);

    await recordUsageEvent({
      organizationId: user.organizationId,
      feature: UsageFeature.SAVING_CARDS,
      quantity: normalized.length,
      window: IMPORT_QUOTA_WINDOW,
      source: "api.saving_cards.import",
      reason: "xlsx_import",
      metadata: {
        importedCount: normalized.length,
        actorUserId: user.id,
      },
    });

    return NextResponse.json({ count: normalized.length });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Import payload is invalid." },
        { status: 422 }
      );
    }

    if (error instanceof RateLimitExceededError) {
      return createRateLimitErrorResponse(error);
    }

    if (error instanceof ImportFileError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof UsageQuotaExceededError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status: 500 }
    );
  }
}
