import * as XLSX from "xlsx";
import { getSavingCards, mapSavingCardsForExport } from "@/lib/data";

export async function GET() {
  const cards = await getSavingCards();
  const rows = mapSavingCardsForExport(cards);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Savings");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="traxium-savings.xlsx"'
    }
  });
}
