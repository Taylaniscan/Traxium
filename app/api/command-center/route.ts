import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getCommandCenterData } from "@/lib/data";

const FILTER_KEYS = [
  "categoryId",
  "businessUnitId",
  "buyerId",
  "plantId",
  "supplierId",
] as const;

const commandCenterFilterSchema = z.object({
  categoryId: z.string().trim().min(1).optional(),
  businessUnitId: z.string().trim().min(1).optional(),
  buyerId: z.string().trim().min(1).optional(),
  plantId: z.string().trim().min(1).optional(),
  supplierId: z.string().trim().min(1).optional(),
});

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function normalizeFilterValue(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const { searchParams } = new URL(request.url);
    const duplicateKey = FILTER_KEYS.find((key) => searchParams.getAll(key).length > 1);

    if (duplicateKey) {
      return jsonError(`Query parameter "${duplicateKey}" must only be provided once.`, 400);
    }

    const filters = commandCenterFilterSchema.safeParse({
      categoryId: normalizeFilterValue(searchParams.get("categoryId")),
      businessUnitId: normalizeFilterValue(searchParams.get("businessUnitId")),
      buyerId: normalizeFilterValue(searchParams.get("buyerId")),
      plantId: normalizeFilterValue(searchParams.get("plantId")),
      supplierId: normalizeFilterValue(searchParams.get("supplierId")),
    });

    if (!filters.success) {
      return jsonError(filters.error.issues[0]?.message ?? "Command center filters are invalid.", 422);
    }

    const data = await getCommandCenterData(user.organizationId, filters.data);

    return NextResponse.json(data);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to load command center.",
      500
    );
  }
}
