import { ZodError } from "zod";
import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { getVolumeTimeline } from "@/lib/volume";
import {
  jsonError,
  resolveVolumeCardContext,
  volumeCardParamsSchema,
} from "./shared";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser({ redirectTo: null });
    const { id } = volumeCardParamsSchema.parse(await params);
    const card = await resolveVolumeCardContext(id, user.organizationId);

    if (!card) {
      return jsonError("Saving card not found.", 404);
    }

    const result = await getVolumeTimeline(card.id, user.organizationId);

    return Response.json(result);
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Saving card id is invalid.", 422);
    }

    return jsonError(
      error instanceof Error ? error.message : "Volume timeline could not be loaded.",
      500
    );
  }
}
