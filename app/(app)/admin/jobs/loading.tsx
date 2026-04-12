import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";

function LoadingMetricCard() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="h-4 w-20 animate-pulse rounded-full bg-slate-100" />
      <div className="mt-4 h-8 w-16 animate-pulse rounded-full bg-slate-100" />
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
        <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
      </CardContent>
    </Card>
  );
}

export default function AdminJobsLoadingPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SectionHeading title="Job Health" />
        <div className="h-5 w-full max-w-2xl animate-pulse rounded-full bg-slate-100" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <LoadingMetricCard key={index} />
            ))}
          </div>
          <LoadingPanel title="Recent Jobs" />
        </div>
        <LoadingPanel title="Worker Commands" />
      </div>
    </div>
  );
}
