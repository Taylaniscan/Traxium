import * as XLSX from "xlsx";
import { z } from "zod";

import {
  MASTER_DATA_ONBOARDING_ENTITY_KEYS,
  getMasterDataOnboardingStepConfig,
  type MasterDataOnboardingEntityKey,
} from "@/lib/onboarding/master-data-config";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_UPLOAD_ROWS = 250;
const separators = { comma: ",", semicolon: ";", tab: "\t" } as const;

export class StarterUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StarterUploadError";
  }
}

export type ParsedStarterUpload = {
  entity: MasterDataOnboardingEntityKey;
  rows: Array<Record<string, unknown>>;
  rowOffset: number;
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/gu, "")
    .toLowerCase();
}

export async function parseStarterUpload(
  form: FormData,
): Promise<ParsedStarterUpload> {
  const entityResult = z
    .enum(MASTER_DATA_ONBOARDING_ENTITY_KEYS)
    .safeParse(form.get("entity"));
  if (!entityResult.success)
    throw new StarterUploadError("Choose a valid upload step.");
  const entity = entityResult.data;
  const file = form.get("file");
  if (!(file instanceof File) || !file.size)
    throw new StarterUploadError("Choose a CSV or XLSX file to upload.");
  if (file.size > MAX_UPLOAD_BYTES)
    throw new StarterUploadError(
      "The file is too large. Use a file smaller than 2 MB.",
    );
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (extension !== ".csv" && extension !== ".xlsx")
    throw new StarterUploadError("Upload a CSV or XLSX file.");
  const separatorResult = z
    .enum(["comma", "semicolon", "tab"])
    .safeParse(form.get("separator") ?? "comma");
  if (!separatorResult.success)
    throw new StarterUploadError("Choose a valid CSV separator.");

  let workbook: XLSX.WorkBook;
  try {
    workbook =
      extension === ".csv"
        ? XLSX.read(await file.text(), {
            type: "string",
            FS: separators[separatorResult.data],
          })
        : XLSX.read(await file.arrayBuffer(), { type: "array" });
  } catch {
    throw new StarterUploadError(
      "The file could not be read. Check that it is a valid CSV or XLSX file.",
    );
  }
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet)
    throw new StarterUploadError("The file does not contain a worksheet.");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  });
  const headerValues = matrix[0] ?? [];
  if (!headerValues.length)
    throw new StarterUploadError("The first row must contain column names.");
  const config = getMasterDataOnboardingStepConfig(entity);
  const canonicalHeaders = headerValues.map((value) => {
    const normalized = normalizeHeader(value);
    return (
      config.templateHeaders.find(
        (header) => normalizeHeader(header) === normalized,
      ) ?? null
    );
  });
  const unknown = headerValues.find(
    (value, index) => String(value).trim() && !canonicalHeaders[index],
  );
  if (unknown)
    throw new StarterUploadError(
      `Column "${String(unknown).trim()}" is not supported for ${config.pluralLabel}. Download the step template.`,
    );
  const nonemptyHeaders = canonicalHeaders.filter((value): value is string =>
    Boolean(value),
  );
  if (new Set(nonemptyHeaders).size !== nonemptyHeaders.length)
    throw new StarterUploadError(
      "A column heading appears more than once. Keep one of each heading.",
    );
  const missing = config.requiredColumns.find(
    (column) => !nonemptyHeaders.includes(column.key),
  );
  if (missing)
    throw new StarterUploadError(
      `Missing required column: ${missing.key}. Download the step template.`,
    );
  const unlabeledCell = matrix.slice(1).some((values) =>
    values.some((value, index) =>
      !canonicalHeaders[index] && String(value ?? "").trim(),
    ),
  );
  if (unlabeledCell)
    throw new StarterUploadError(
      "A data column has no heading. Add a supported heading or remove that column.",
    );
  const rows = matrix
    .slice(1)
    .map((values) =>
      Object.fromEntries(
        canonicalHeaders.flatMap((header, index) =>
          header ? [[header, values[index] ?? ""]] : [],
        ),
      ),
    );
  if (
    !rows.some((row) =>
      Object.values(row).some((value) => String(value).trim()),
    )
  )
    throw new StarterUploadError(
      "Add at least one data row below the headings.",
    );
  if (rows.length > MAX_UPLOAD_ROWS)
    throw new StarterUploadError(
      `Upload up to ${MAX_UPLOAD_ROWS} rows at a time.`,
    );
  return { entity, rows, rowOffset: 1 };
}
