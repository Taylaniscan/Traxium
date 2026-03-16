export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { getReferenceData } from "@/lib/data";

type ReferenceData = Awaited<ReturnType<typeof getReferenceData>>;

export default async function AdminPage() {
  let referenceData: ReferenceData = {
    users: [],
    suppliers: [],
    materials: [],
    categories: [],
    plants: [],
    businessUnits: [],
    fxRates: [],
  };

  try {
    referenceData = await getReferenceData();
  } catch (error) {
    console.log("Admin reference data could not be loaded:", error);
  }

  return (
    <div className="space-y-6">
      <SectionHeading title="Settings" />
      <div className="grid gap-6 xl:grid-cols-3">
        <SummaryCard
          title="Users"
          values={referenceData.users.map((item) => `${item.name} · ${item.role}`)}
        />
        <SummaryCard
          title="Suppliers"
          values={referenceData.suppliers.map((item) => item.name)}
        />
        <SummaryCard
          title="Categories"
          values={referenceData.categories.map(
            (item) => `${item.name} · Target ${item.annualTarget}`
          )}
        />
      </div>
    </div>
  );
}

function SummaryCard({ title, values }: { title: string; values: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {values.map((value) => (
          <div key={value} className="rounded-xl bg-slate-50 p-3">
            {value}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}