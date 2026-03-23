import { ZodError, z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  deleteForecast,
  parsePeriodInput,
  upsertForecast,
} from "@/lib/volume";
import {
  isPlainObject,
  jsonError,
  readJsonBody,
  resolveVolumeCardContext,
  volumeCardParamsSchema,
} from "../shared";

const forecastBodySchema = z.object({
  period: z.string().trim().min(1, "Period is required."),
  forecastQty: z.number().finite().min(0, "Forecast quantity must be zero or greater."),
  unit: z.string().trim().min(1, "Unit is required."),
  notes: z.string().trim().optional(),
});

const deleteBodySchema = z.object({
  period: z.string().trim().min(1, "Period is required."),
});

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

    const payload = forecastBodySchema.parse(body.data);
    const period = parsePeriodInput(payload.period);

    const result = await upsertForecast({
      savingCardId: card.id,
      materialId: card.materialId,
      supplierId: card.supplierId,
      period,
      forecastQty: payload.forecastQty,
      unit: payload.unit,
      notes: payload.notes,
      createdById: user.id,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Forecast payload is invalid.", 422);
    }

    return jsonError(
      error instanceof Error ? error.message : "Forecast could not be saved.",
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

    await deleteForecast(card.id, card.materialId, period);

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Forecast delete payload is invalid.", 422);
    }

    return jsonError(
      error instanceof Error ? error.message : "Forecast could not be deleted.",
      500
    );
  }
}
