import * as XLSX from "xlsx";

import {
  controllerSavingCardColumns,
  evidenceSummaryColumns,
  importTemplateColumns,
  type ControllerWorkbookModel,
} from "@/lib/export/controller-workbook";

type StyledWorksheet = XLSX.WorkSheet & {
  "!freeze"?: {
    xSplit?: number;
    ySplit?: number;
    topLeftCell?: string;
    activePane?: string;
    state?: string;
  };
};

function styleCell(
  worksheet: XLSX.WorkSheet,
  address: string,
  style: Record<string, unknown>
) {
  const cell = worksheet[address] as
    | (XLSX.CellObject & { s?: Record<string, unknown> })
    | undefined;

  if (cell) {
    cell.s = style;
  }
}

function styleHeaderRow(
  worksheet: XLSX.WorkSheet,
  rowIndex: number,
  columnCount: number
) {
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    styleCell(
      worksheet,
      XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex }),
      {
        fill: { fgColor: { rgb: "17324D" } },
        font: { bold: true, color: { rgb: "FFFFFF" } },
        alignment: { vertical: "center", wrapText: true },
      }
    );
  }
}

function setTableSheetLayout(
  worksheet: XLSX.WorkSheet,
  headers: readonly string[],
  widths: Partial<Record<string, number>> = {}
) {
  worksheet["!cols"] = headers.map((header) => ({
    wch: widths[header] ?? Math.min(Math.max(header.length + 3, 13), 34),
  }));
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: 0, c: Math.max(headers.length - 1, 0) },
    }),
  };
  (worksheet as StyledWorksheet)["!freeze"] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: "A2",
    activePane: "bottomLeft",
    state: "frozen",
  };
  styleHeaderRow(worksheet, 0, headers.length);
}

function applyColumnFormats(
  worksheet: XLSX.WorkSheet,
  headers: readonly string[],
  rowCount: number
) {
  const currencyHeaders = new Set([
    "Baseline Price",
    "New Price",
    "Reference Price",
    "Calculated Savings (Local)",
    "Savings USD",
    "In-Year Value (FY)",
    "Annualized Run-Rate",
  ]);
  const numberHeaders = new Set(["Annual Volume", "Evidence Count"]);
  const dateHeaders = new Set([
    "Impact Start Date",
    "Impact End Date",
    "Last Evidence Upload Date",
    "Last Phase Change Date",
    "Last Updated",
  ]);

  headers.forEach((header, columnIndex) => {
    for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
      const cell = worksheet[
        XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })
      ];

      if (!cell) continue;
      // US currency: dollar sign, thousands separators, no cents.
      if (currencyHeaders.has(header)) cell.z = "\"$\"#,##0";
      if (numberHeaders.has(header)) cell.z = "#,##0";
      // US date format MM/DD/YYYY.
      if (dateHeaders.has(header) && cell.t === "d") cell.z = "mm/dd/yyyy";
    }
  });
}

function setSummarySheetLayout(worksheet: XLSX.WorkSheet) {
  worksheet["!cols"] = [{ wch: 42 }, { wch: 24 }, { wch: 54 }];
  (worksheet as StyledWorksheet)["!freeze"] = {
    xSplit: 0,
    ySplit: 2,
    topLeftCell: "A3",
    activePane: "bottomLeft",
    state: "frozen",
  };
  styleHeaderRow(worksheet, 1, 3);
  styleCell(worksheet, "A1", {
    fill: { fgColor: { rgb: "0F766E" } },
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 16 },
  });

  const range = worksheet["!ref"]
    ? XLSX.utils.decode_range(worksheet["!ref"])
    : null;

  if (!range) return;

  for (let rowIndex = 2; rowIndex <= range.e.r; rowIndex += 1) {
    const labelCell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: 0 })];
    const valueCell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: 1 })];
    const noteCell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: 2 })];
    const label = typeof labelCell?.v === "string" ? labelCell.v : "";

    if (label && !valueCell?.v && !noteCell?.v) {
      for (let columnIndex = 0; columnIndex < 3; columnIndex += 1) {
        styleCell(
          worksheet,
          XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex }),
          {
            fill: { fgColor: { rgb: "DCEAF2" } },
            font: { bold: true, color: { rgb: "17324D" } },
          }
        );
      }
    }

    if (label.endsWith("(USD)") && valueCell) {
      valueCell.z = "\"$\"#,##0";
    }
    if (
      (label.includes("Update") || label.includes("Generated At")) &&
      valueCell?.t === "d"
    ) {
      valueCell.z = "mm/dd/yyyy hh:mm";
    }
  }
}

export function createControllerWorkbook(input: {
  model: ControllerWorkbookModel;
  workspaceName: string;
}) {
  const { model, workspaceName } = input;
  const summarySheet = XLSX.utils.aoa_to_sheet(model.portfolioSummaryRows, {
    cellDates: true,
  });
  const savingCardsSheet = XLSX.utils.json_to_sheet(model.savingCardRows, {
    header: [...controllerSavingCardColumns],
    cellDates: true,
  });
  const dataDictionarySheet = XLSX.utils.aoa_to_sheet(
    model.dataDictionaryRows
  );
  const importTemplateSheet = XLSX.utils.json_to_sheet(
    model.importTemplateRows,
    {
      header: [...importTemplateColumns],
    }
  );
  const evidenceSummarySheet = XLSX.utils.json_to_sheet(
    model.evidenceSummaryRows,
    {
      header: [...evidenceSummaryColumns],
      cellDates: true,
    }
  );
  const workbook = XLSX.utils.book_new();

  workbook.Props = {
    Title: `${workspaceName} controller review workbook`,
    Subject: "Traxium controller-ready procurement savings export",
    Author: "Traxium",
    Company: workspaceName,
    CreatedDate: model.generatedAt,
  };

  setSummarySheetLayout(summarySheet);
  setTableSheetLayout(savingCardsSheet, controllerSavingCardColumns, {
    "Saving Card Title": 34,
    "Business Case / Notes": 44,
    "Evidence Types": 36,
    "Pending Approval Status": 28,
  });
  applyColumnFormats(
    savingCardsSheet,
    controllerSavingCardColumns,
    model.savingCardRows.length
  );
  setTableSheetLayout(
    dataDictionarySheet,
    ["Column / Term", "Definition", "Accepted Values / Review Note"],
    {
      "Column / Term": 30,
      Definition: 58,
      "Accepted Values / Review Note": 62,
    }
  );
  setTableSheetLayout(importTemplateSheet, importTemplateColumns, {
    Title: 34,
    "Business Case / Notes": 44,
  });
  setTableSheetLayout(evidenceSummarySheet, evidenceSummaryColumns, {
    "Saving Card Title": 34,
    "Evidence Types": 42,
  });
  applyColumnFormats(
    evidenceSummarySheet,
    evidenceSummaryColumns,
    model.evidenceSummaryRows.length
  );

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Portfolio Summary");
  XLSX.utils.book_append_sheet(workbook, savingCardsSheet, "Saving Cards");
  XLSX.utils.book_append_sheet(workbook, dataDictionarySheet, "Data Dictionary");
  XLSX.utils.book_append_sheet(workbook, importTemplateSheet, "Import Template");
  XLSX.utils.book_append_sheet(workbook, evidenceSummarySheet, "Evidence Summary");

  return workbook;
}

export function renderControllerWorkbookXlsx(input: {
  model: ControllerWorkbookModel;
  workspaceName: string;
}) {
  return XLSX.write(createControllerWorkbook(input), {
    type: "buffer",
    bookType: "xlsx",
    cellDates: true,
    cellStyles: true,
  });
}
