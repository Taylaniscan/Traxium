import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import * as XLSX from "xlsx";

import { getSavingCards, getWorkspaceReadiness } from "@/lib/data";
import { buildControllerWorkbookModel } from "@/lib/export/controller-workbook";
import { renderControllerWorkbookXlsx } from "@/lib/export/controller-workbook-xlsx";
import { prisma } from "@/lib/prisma";

const UTOPIATRAX_SLUG = "utopiatrax";

export async function exportUtopiaTraxControllerWorkbook(
  outputPath = path.join(
    process.cwd(),
    "outputs",
    "utopiatrax",
    `traxium-utopiatrax-controller-review-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`
  )
) {
  const organization = await prisma.organization.findUnique({
    where: {
      slug: UTOPIATRAX_SLUG,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  if (!organization) {
    throw new Error(
      "UtopiaTrax was not found. Seed an approved non-production database before exporting."
    );
  }

  const [cards, workspaceReadiness] = await Promise.all([
    getSavingCards(organization.id),
    getWorkspaceReadiness(organization.id),
  ]);
  const model = buildControllerWorkbookModel({
    cards,
    generatedAt: new Date(),
    workspaceReadiness,
  });
  const buffer = renderControllerWorkbookXlsx({
    model,
    workspaceName: organization.name,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);

  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellStyles: true,
  });

  return {
    outputPath,
    workspace: organization.name,
    savingCardCount: cards.length,
    sheetNames: workbook.SheetNames,
    reconciliationDifference: model.reconciliation.difference,
    evidenceCoveragePercent: model.reconciliation.evidenceCoveragePercent,
  };
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  exportUtopiaTraxControllerWorkbook(process.argv[2])
    .then((result) => {
      console.log("PASS UtopiaTrax controller workbook exported");
      console.log(`Workspace: ${result.workspace}`);
      console.log(`Saving cards: ${result.savingCardCount}`);
      console.log(`Sheets: ${result.sheetNames.join(", ")}`);
      console.log(`Evidence coverage: ${result.evidenceCoveragePercent}%`);
      console.log(
        `Reconciliation difference: ${result.reconciliationDifference}`
      );
      console.log(`File: ${result.outputPath}`);
    })
    .catch((error) => {
      console.error(
        error instanceof Error
          ? `FAIL ${error.message}`
          : "FAIL Controller workbook export failed."
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
