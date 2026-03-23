import { ZodError, z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  deleteActual,
  parsePeriodInput,
  upsertActual,
} from "@/lib/volume";
import {
  isPlainObject,
  jsonError,
  readJsonBody,
  resolveVolumeCardContext,
  volumeCardParamsSchema,
} from "../shared";

const actualBodySchema = z.object({
  period: z.string().trim().min(1, "Period is required."),
  actualQty: z.number().finite().min(0, "Actual quantity must be zero or greater."),
  unit: z.string().trim().min(1, "Unit is required."),
  invoiceRef: z.string().trim().optional(),
});

const deleteBodySchema = z.object({
  period: z.string().trim().min(1, "Period is required."),
});

function currentMonthStartUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
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

    const body = await readJsonBody(request);

    if (!body.ok) {
      return body.response;
    }

    if (!isPlainObject(body.data)) {
      return jsonError("Request body must be a JSON object.", 400);
    }

    const payload = actualBodySchema.parse(body.data);
    const period = parsePeriodInput(payload.period);

    if (period.getTime() >= currentMonthStartUtc().getTime()) {
      return jsonError("Actuals can only be entered for past months.", 400);
    }

    const result = await upsertActual({
      savingCardId: card.id,
      materialId: card.materialId,
      supplierId: card.supplierId,
      period,
      actualQty: payload.actualQty,
      unit: payload.unit,
      invoiceRef: payload.invoiceRef,
      confirmedById: user.id,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Actual payload is invalid.", 422);
    }

    return jsonError(
      error instanceof Error ? error.message : "Actual could not be saved.",
      500
    );
  }
}

export async function DELETE(
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

    const body = await readJsonBody(request);

    if (!body.ok) {
      return body.response;
    }

    if (!isPlainObject(body.data)) {
      return jsonError("Request body must be a JSON object.", 400);
    }

    const payload = deleteBodySchema.parse(body.data);
    const period = parsePeriodInput(payload.period);

    await deleteActual(card.id, card.materialId, period);

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Actual delete payload is invalid.", 422);
    }

    return jsonError(
      error instanceof Error ? error.message : "Actual could not be deleted.",
      500
    );
  }
}
