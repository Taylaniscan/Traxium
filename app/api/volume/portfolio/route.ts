import { z } from "zod";

import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { getPortfolioVolumeTimelines } from "@/lib/volume";

const portfolioVolumeQuerySchema = z.object({
  cardIds: z
    .array(z.string().trim().min(1))
    .min(1, "At least one saving card id is required.")
    .max(100, "No more than 100 saving cards can be requested at once."),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser({ redirectTo: null });
    const url = new URL(request.url);
    const { cardIds } = portfolioVolumeQuerySchema.parse({
      cardIds: url.searchParams.getAll("cardId"),
    });
    const timelines = await getPortfolioVolumeTimelines(
      cardIds,
      user.organizationId
    );

    return Response.json({ timelines });
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message ?? "Saving card ids are invalid." },
        { status: 422 }
      );
    }

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Portfolio volume timeline could not be loaded.",
      },
      { status: 500 }
    );
  }
}
