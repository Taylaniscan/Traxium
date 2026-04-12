import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";

function LoadingMetricCard() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="h-4 w-28 animate-pulse rounded-full bg-slate-100" />
      <div className="mt-4 h-8 w-20 animate-pulse rounded-full bg-slate-100" />
      <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-100" />
    </div>
  );
}

function LoadingPanel({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
      </CardContent>
    </Card>
  );
}

export default function AdminInsightsLoadingPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SectionHeading title="Admin Insights" />
        <div className="h-5 w-full max-w-2xl animate-pulse rounded-full bg-slate-100" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <LoadingMetricCard key={index} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <LoadingPanel title="Activation Signals" />
        <LoadingPanel title="System Health" />
      </div>

      <LoadingPanel title="Recent Admin Activity" />
    </div>
  );
}
