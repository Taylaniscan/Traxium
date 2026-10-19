import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  buildMasterDataTemplateCsv,
  buildStarterUploadTemplateCsv,
  getMasterDataOnboardingStepConfig,
  MASTER_DATA_ONBOARDING_ENTITY_KEYS,
} from "@/lib/onboarding/master-data-config";

const templateParamsSchema = z.object({
  entity: z.enum(MASTER_DATA_ONBOARDING_ENTITY_KEYS),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  try {
    const { entity } = templateParamsSchema.parse(await params);
    const config = getMasterDataOnboardingStepConfig(entity);
    const starter = new URL(request.url).searchParams.get("starter") === "1";
    const csv = starter
      ? buildStarterUploadTemplateCsv(entity)
      : buildMasterDataTemplateCsv(entity);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${starter ? `traxium-${entity}-starter-template.csv` : config.templateFileName}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Template not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not build onboarding template.",
      },
      { status: 500 },
    );
  }
}
