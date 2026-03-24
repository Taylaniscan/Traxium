import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSavingCards, getWorkspaceReadiness, mapSavingCardsForExport } from "@/lib/data";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const [cards, workspaceReadiness] = await Promise.all([
      getSavingCards(user),
      getWorkspaceReadiness(user),
    ]);
    const rows = mapSavingCardsForExport(cards);
    const generatedAt = new Date();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ["Workspace", workspaceReadiness.workspace.name],
      ["Workspace Slug", workspaceReadiness.workspace.slug],
      ["Generated At (UTC)", generatedAt.toISOString()],
      ["Portfolio Scope", `${cards.length} saving card${cards.length === 1 ? "" : "s"} included`],
      ["Active Cards", String(cards.filter((card) => card.phase !== "CANCELLED").length)],
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
      ["Reporting Basis", "Organization-scoped live saving-card portfolio"],
    ]);
    const workbook = XLSX.utils.book_new();
    workbook.Props = {
      Title: `${workspaceReadiness.workspace.name} savings report`,
      Subject: "Traxium savings export",
      Author: "Traxium",
      Company: workspaceReadiness.workspace.name,
      CreatedDate: generatedAt,
    };
    summarySheet["!cols"] = [{ wch: 26 }, { wch: 42 }];
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
    return jsonError(
      error instanceof Error ? error.message : "Export failed.",
      500
    );
  }
}
