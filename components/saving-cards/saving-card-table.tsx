import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { getValueBadgeTone } from "@/lib/calculations";
import { phaseLabels } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils/numberFormatter";
import type { SavingCardWithRelations } from "@/lib/types";

export function SavingCardTable({ cards }: { cards: SavingCardWithRelations[] }) {
  const totalSavings = cards.reduce((sum, card) => sum + card.calculatedSavings, 0);
  const lockedCount = cards.filter((card) => card.financeLocked).length;
  const realisedCount = cards.filter((card) => card.phase === "REALISED" || card.phase === "ACHIEVED").length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryTile label="Portfolio Savings" value={formatCurrency(Math.round(totalSavings), "EUR")} />
        <SummaryTile label="Finance Locked Cards" value={String(lockedCount)} />
        <SummaryTile label="Realised or Achieved" value={String(realisedCount)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-end justify-between gap-4">
          <div>
            <CardTitle>Saving Cards</CardTitle>
            <p className="mt-1 text-[14px] text-[var(--muted-foreground)]">
              Operational register of all initiatives, with phase, owner, supplier, and finance controls.
            </p>
          </div>
        </CardHeader>
        <CardContent>
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
          <Table className="min-w-[980px] bg-white">
            <TableHead>
              <tr>
                <TableHeaderCell>Title</TableHeaderCell>
                <TableHeaderCell>Phase</TableHeaderCell>
                <TableHeaderCell>Category</TableHeaderCell>
                <TableHeaderCell>Buyer</TableHeaderCell>
                <TableHeaderCell>Supplier</TableHeaderCell>
                <TableHeaderCell className="text-right">Savings</TableHeaderCell>
                <TableHeaderCell>Timing</TableHeaderCell>
                <TableHeaderCell>Lock</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {cards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell>
                    <Link href={`/saving-cards/${card.id}`} className="font-semibold text-[var(--foreground)] hover:text-[var(--primary)] hover:underline">
                      {card.title}
                    </Link>
                    <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">{card.savingType}</p>
                  </TableCell>
                  <TableCell>
                    <Badge tone={getValueBadgeTone(card.phase)}>{phaseLabels[card.phase]}</Badge>
                  </TableCell>
                  <TableCell>{card.category.name}</TableCell>
                  <TableCell>{card.buyer.name}</TableCell>
                  <TableCell>{card.supplier.name}</TableCell>
                  <TableCell className="text-right">
                    <p className="font-semibold">{formatCurrency(Math.round(card.calculatedSavings), "EUR")}</p>
                    <p className="text-[12px] text-[var(--muted-foreground)]">{card.currency} basis</p>
                  </TableCell>
                  <TableCell>
                    <p>{formatDate(card.impactStartDate)}</p>
                    <p className="text-[12px] text-[var(--muted-foreground)]">to {formatDate(card.impactEndDate)}</p>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        card.financeLocked
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                          : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                      }
                    >
                      {card.financeLocked ? "Locked" : "Open"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-white">
      <CardContent className="p-5">
        <p className="text-[1.7rem] font-semibold tracking-[-0.03em]">{value}</p>
        <p className="mt-2 text-[12px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{label}</p>
      </CardContent>
    </Card>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(date));
}
