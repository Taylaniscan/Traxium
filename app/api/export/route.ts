import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { phaseLabels, phases } from "@/lib/constants";
import {
  getSavingCards,
  getWorkspaceReadiness,
  mapSavingCardsForExport,
  savingCardExportColumns,
} from "@/lib/data";
import {
  createRateLimitErrorResponse,
  enforceRateLimit,
  RateLimitExceededError,
} from "@/lib/rate-limit";
import type { SavingCardPortfolio, WorkspaceReadiness } from "@/lib/types";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function normalizeExportNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sumSavings(cards: SavingCardPortfolio[]) {
  return cards.reduce(
    (sum, card) => sum + normalizeExportNumber(card.calculatedSavings),
    0
  );
}

function buildReportSummaryRows(input: {
  cards: SavingCardPortfolio[];
  generatedAt: Date;
  workspaceReadiness: WorkspaceReadiness;
}) {
  const { cards, generatedAt, workspaceReadiness } = input;
  const activeCards = cards.filter((card) => card.phase !== "CANCELLED");
  const financeLockedCards = cards.filter((card) => card.financeLocked);
  const rows: Array<[string, string | number]> = [
    ["Workspace", workspaceReadiness.workspace.name],
    ["Workspace Slug", workspaceReadiness.workspace.slug],
    ["Generated At (UTC)", generatedAt.toISOString()],
    ["Reporting Basis", "Organization-scoped live saving-card portfolio"],
    ["Portfolio Scope", cards.length],
    ["Active Cards", activeCards.length],
    ["Active Savings (EUR)", sumSavings(activeCards)],
    [
      "Realized Savings (EUR)",
      sumSavings(cards.filter((card) => card.phase === "REALISED")),
    ],
    [
      "Achieved Savings (EUR)",
      sumSavings(cards.filter((card) => card.phase === "ACHIEVED")),
    ],
    ["Finance Locked Cards", financeLockedCards.length],
    ["Finance Locked Savings (EUR)", sumSavings(financeLockedCards)],
    ["Setup Completeness", `${workspaceReadiness.coverage.overallPercent}%`],
    [
      "Master Data Coverage",
      `${workspaceReadiness.coverage.masterDataReadyCount}/${workspaceReadiness.coverage.masterDataTotal}`,
    ],
    [
      "Workflow Coverage",
      `${workspaceReadiness.coverage.workflowReadyCount}/${workspaceReadiness.coverage.workflowTotal}`,
    ],
    [
      "Last Portfolio Update (UTC)",
      workspaceReadiness.activity.lastPortfolioUpdateAt?.toISOString() ?? "Not available",
    ],
  ];

  for (const phase of phases) {
    rows.push([
      `${phaseLabels[phase]} Cards`,
      cards.filter((card) => card.phase === phase).length,
    ]);
  }

  return rows;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser({ redirectTo: null });
    await enforceRateLimit({
      policy: "dataExport",
      request,
      userId: user.id,
      organizationId: user.organizationId,
      action: "saving-cards.export",
    });

    const [cards, workspaceReadiness] = await Promise.all([
      getSavingCards(user),
      getWorkspaceReadiness(user),
    ]);
    const rows = mapSavingCardsForExport(cards);
    const generatedAt = new Date();
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [...savingCardExportColumns],
    });
    const summarySheet = XLSX.utils.aoa_to_sheet(
      buildReportSummaryRows({
        cards,
        generatedAt,
        workspaceReadiness,
      })
    );
    const workbook = XLSX.utils.book_new();
    workbook.Props = {
      Title: `${workspaceReadiness.workspace.name} savings report`,
      Subject: "Traxium savings export",
      Author: "Traxium",
      Company: workspaceReadiness.workspace.name,
      CreatedDate: generatedAt,
    };
    summarySheet["!cols"] = [{ wch: 26 }, { wch: 42 }];
    worksheet["!cols"] = savingCardExportColumns.map((header) => ({
      wch: Math.min(Math.max(header.length + 4, 14), 30),
    }));
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Report Summary");
    XLSX.utils.book_append_sheet(workbook, worksheet, "Savings");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const exportDate = generatedAt.toISOString().slice(0, 10);
    const fileName = `traxium-${workspaceReadiness.workspace.slug}-savings-report-${exportDate}.xlsx`;

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof RateLimitExceededError) {
      return createRateLimitErrorResponse(error);
    }

    return jsonError(
      error instanceof Error ? error.message : "Export failed.",
      500
    );
  }
}
