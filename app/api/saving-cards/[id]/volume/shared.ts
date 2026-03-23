import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const volumeCardParamsSchema = z.object({
  id: z.string().trim().min(1, "Saving card id is required."),
});

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, data: await request.json() };
  } catch {
    return {
      ok: false as const,
      response: jsonError("Request body must be valid JSON.", 400),
    };
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function resolveVolumeCardContext(id: string, organizationId: string) {
  return prisma.savingCard.findFirst({
    where: {
      id,
      organizationId,
    },
    select: {
      id: true,
      materialId: true,
      supplierId: true,
      baselinePrice: true,
      newPrice: true,
      annualVolume: true,
      volumeUnit: true,
      currency: true,
      material: {
        select: {
          name: true,
        },
      },
    },
  });
}
