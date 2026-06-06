import fs from "node:fs/promises";

import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbookPath =
  "/Users/atlas/Documents/Traxium/outputs/utopiatrax/traxium-utopiatrax-controller-review-2026-06-06.xlsx";
const outputDir =
  "/Users/atlas/Documents/Traxium/outputs/cynic-gap-audit/workbook-renders";
const requiredSheets = [
  "Portfolio Summary",
  "Saving Cards",
  "Data Dictionary",
  "Import Template",
  "Evidence Summary",
];

await fs.mkdir(outputDir, { recursive: true });

const workbook = await SpreadsheetFile.importXlsx(
  await FileBlob.load(workbookPath)
);
const summary = await workbook.inspect({
  kind: "table",
  range: "Portfolio Summary!A1:C78",
  include: "values,formulas",
  tableMaxRows: 78,
  tableMaxCols: 3,
});
const savingCards = await workbook.inspect({
  kind: "table",
  range: "Saving Cards!A1:AH26",
  include: "values,formulas",
  tableMaxRows: 26,
  tableMaxCols: 34,
});
const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "controller workbook formula error scan",
});
const sensitiveData = await workbook.inspect({
  kind: "match",
  searchTerm:
    "supabase\\.co|storagePath|storageBucket|service_role|signedUrl|token=|organizations/.+/saving-cards/",
  options: { useRegex: true, maxResults: 300 },
  summary: "controller workbook sensitive data scan",
});

for (const sheetName of requiredSheets) {
  const image = await workbook.render({
    sheetName,
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    `${outputDir}/${sheetName.toLowerCase().replaceAll(" ", "-")}.png`,
    Buffer.from(await image.arrayBuffer())
  );
}

console.log(
  JSON.stringify(
    {
      workbookPath,
      requiredSheets,
      summaryInspection: summary.ndjson,
      savingCardsInspection: savingCards.ndjson,
      formulaErrorScan: formulaErrors.ndjson,
      sensitiveDataScan: sensitiveData.ndjson,
      renderDir: outputDir,
    },
    null,
    2
  )
);
