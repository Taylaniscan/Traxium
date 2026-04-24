import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { createAuthGuardErrorResponse, requirePermission } from "@/lib/auth";
import {
  MASTER_DATA_ONBOARDING_ENTITY_KEYS,
  getMasterDataOnboardingStepConfig,
  type MasterDataOnboardingEntityKey,
} from "@/lib/onboarding/master-data-config";
import { prisma } from "@/lib/prisma";
import {
  RateLimitExceededError,
  createRateLimitErrorResponse,
  enforceRateLimit,
} from "@/lib/rate-limit";

type StarterDataStatus = "created" | "skipped" | "failed";

type StarterDataResult = {
  row: number;
  status: StarterDataStatus;
  name: string;
  message: string;
};

type NormalizedStarterRow = Record<string, string>;

const starterDataSchema = z.object({
  entity: z.enum(MASTER_DATA_ONBOARDING_ENTITY_KEYS),
  rows: z.array(z.record(z.unknown())).min(1).max(25),
});

function normalizeCell(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function normalizeKey(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function normalizeStarterRow(
  entity: MasterDataOnboardingEntityKey,
  row: Record<string, unknown>
) {
  const config = getMasterDataOnboardingStepConfig(entity);

  return Object.fromEntries(
    config.templateHeaders.map((header) => [header, normalizeCell(row[header])])
  ) as NormalizedStarterRow;
}

function isEmptyStarterRow(row: NormalizedStarterRow) {
  return Object.values(row).every((value) => !value);
}

function createResult(
  row: number,
  status: StarterDataStatus,
  name: string,
  message: string
): StarterDataResult {
  return {
    row,
    status,
    name,
    message,
  };
}

function validateStarterRow(
  entity: MasterDataOnboardingEntityKey,
  row: NormalizedStarterRow
): { ok: true; value: NormalizedStarterRow } | { ok: false; message: string } {
  const config = getMasterDataOnboardingStepConfig(entity);

  for (const column of config.requiredColumns) {
    if (!row[column.key]) {
      return {
        ok: false,
        message: `${column.label} is required.`,
      };
    }
  }

  const email = row.email;
  const contactEmail = row.contactEmail;

  if (email) {
    const validation = z.string().email("Email must be a valid email address.").safeParse(email);

    if (!validation.success) {
      return {
        ok: false,
        message: validation.error.issues[0]?.message ?? "Email must be valid.",
      };
    }
  }

  if (contactEmail) {
    const validation = z
      .string()
      .email("Contact email must be a valid email address.")
      .safeParse(contactEmail);

    if (!validation.success) {
      return {
        ok: false,
        message:
          validation.error.issues[0]?.message ?? "Contact email must be valid.",
      };
    }
  }

  return {
    ok: true,
    value: row,
  };
}

async function getExistingNames(
  entity: MasterDataOnboardingEntityKey,
  organizationId: string
) {
  switch (entity) {
    case "buyers": {
      const records = await prisma.buyer.findMany({
        where: { organizationId },
        select: { name: true },
      });
      return new Set(records.map((record) => normalizeKey(record.name)));
    }
    case "suppliers": {
      const records = await prisma.supplier.findMany({
        where: { organizationId },
        select: { name: true },
      });
      return new Set(records.map((record) => normalizeKey(record.name)));
    }
    case "materials": {
      const records = await prisma.material.findMany({
        where: { organizationId },
        select: { name: true },
      });
      return new Set(records.map((record) => normalizeKey(record.name)));
    }
    case "categories": {
      const records = await prisma.category.findMany({
        where: { organizationId },
        select: { name: true },
      });
      return new Set(records.map((record) => normalizeKey(record.name)));
    }
    case "plants": {
      const records = await prisma.plant.findMany({
        where: { organizationId },
        select: { name: true },
      });
      return new Set(records.map((record) => normalizeKey(record.name)));
    }
    case "businessUnits": {
      const records = await prisma.businessUnit.findMany({
        where: { organizationId },
        select: { name: true },
      });
      return new Set(records.map((record) => normalizeKey(record.name)));
    }
  }
}

async function createStarterRecord(
  entity: MasterDataOnboardingEntityKey,
  organizationId: string,
  row: NormalizedStarterRow
) {
  switch (entity) {
    case "buyers":
      await prisma.buyer.create({
        data: {
          organizationId,
          name: row.name,
          email: row.email || null,
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
    case "plants":
      await prisma.plant.create({
        data: {
          organizationId,
          name: row.name,
          region: row.region,
        },
      });
      return;
    case "businessUnits":
      await prisma.businessUnit.create({
        data: {
          organizationId,
          name: row.name,
        },
      });
      return;
  }
}

function getSingularLabel(entity: MasterDataOnboardingEntityKey) {
  return getMasterDataOnboardingStepConfig(entity).singularLabel;
}

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof requirePermission>>;

  try {
    user = await requirePermission("manageWorkspace", { redirectTo: null });
  } catch (error) {
    const response = createAuthGuardErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }

  try {
    await enforceRateLimit({
      policy: "bulkImport",
      request,
      userId: user.id,
      organizationId: user.organizationId,
      action: "onboarding.master_data.manual",
    });

    const payload = starterDataSchema.parse(await request.json());
    const normalizedRows = payload.rows
      .map((row, index) => ({
        index,
        row: normalizeStarterRow(payload.entity, row),
      }))
      .filter(({ row }) => !isEmptyStarterRow(row));

    if (!normalizedRows.length) {
      return NextResponse.json(
        { error: "Add at least one starter-data row before saving." },
        { status: 422 }
      );
    }

    const existingNames = await getExistingNames(payload.entity, user.organizationId);
    const requestNames = new Set<string>();
    const results: StarterDataResult[] = [];
    const summary = {
      created: 0,
      skipped: 0,
      failed: 0,
    };

    for (const { index, row } of normalizedRows) {
      const rowNumber = index + 1;
      const validation = validateStarterRow(payload.entity, row);
      const name = row.name;

      if (!validation.ok) {
        summary.failed += 1;
        results.push(createResult(rowNumber, "failed", name, validation.message));
        continue;
      }

      const nameKey = normalizeKey(validation.value.name);

      if (requestNames.has(nameKey)) {
        summary.skipped += 1;
        results.push(
          createResult(
            rowNumber,
            "skipped",
            validation.value.name,
            "Duplicate name already appears in this starter table."
          )
        );
        continue;
      }

      if (existingNames.has(nameKey)) {
        summary.skipped += 1;
        results.push(
          createResult(
            rowNumber,
            "skipped",
            validation.value.name,
            "Already exists in this workspace."
          )
        );
        continue;
      }

      try {
        await createStarterRecord(
          payload.entity,
          user.organizationId,
          validation.value
        );

        requestNames.add(nameKey);
        existingNames.add(nameKey);
        summary.created += 1;
        results.push(
          createResult(
            rowNumber,
            "created",
            validation.value.name,
            `Created ${getSingularLabel(payload.entity)} record.`
          )
        );
      } catch (error) {
        summary.failed += 1;
        results.push(
          createResult(
            rowNumber,
            "failed",
            validation.value.name,
            error instanceof Error ? error.message : "Starter row could not be saved."
          )
        );
      }
    }

    return NextResponse.json({
      entity: payload.entity,
      summary,
      results,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error:
            error.issues[0]?.message ?? "Starter-data payload is invalid.",
        },
        { status: 422 }
      );
    }

    if (error instanceof RateLimitExceededError) {
      return createRateLimitErrorResponse(error);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Starter data could not be saved.",
      },
      { status: 500 }
    );
  }
}
