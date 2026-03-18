import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSavingCards, mapSavingCardsForExport } from "@/lib/data";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const cards = await getSavingCards(user.organizationId);
    const rows = mapSavingCardsForExport(cards);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Savings");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="traxium-savings.xlsx"',
      },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Export failed.",
      500
    );
  }
}
