import * as XLSX from "xlsx";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { importFromCsv } from "@/lib/volume";
import {
  jsonError,
  resolveVolumeCardContext,
  volumeCardParamsSchema,
} from "../shared";

const ACCEPTED_EXTENSIONS = new Set([".csv", ".xlsx", ".xls"]);

function getExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();

  try {
    const { id } = volumeCardParamsSchema.parse(await params);
    const card = await resolveVolumeCardContext(id, user.organizationId);

    if (!card) {
      return jsonError("Saving card not found.", 404);
    }

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return jsonError("Request body must be valid form data.", 400);
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("A CSV or Excel file is required.", 422);
    }

    if (!file.size) {
      return jsonError("The uploaded file is empty.", 422);
    }

    const extension = getExtension(file.name);

    if (!ACCEPTED_EXTENSIONS.has(extension)) {
      return jsonError("Upload a .csv or .xlsx file.", 422);
    }

    let csvContent = "";

    if (extension === ".csv") {
      csvContent = await file.text();
    } else {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        return jsonError("The workbook does not contain any sheets.", 422);
      }

      const worksheet = workbook.Sheets[firstSheetName];

      if (!worksheet) {
        return jsonError("The workbook could not be read.", 400);
      }

      csvContent = XLSX.utils.sheet_to_csv(worksheet);
    }

    const result = await importFromCsv(
      card.id,
      csvContent,
      user.id,
      user.organizationId
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Saving card id is invalid.", 422);
    }

    return jsonError(
      error instanceof Error ? error.message : "Volume import failed.",
      500
    );
  }
}
