import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";

function LoadingCard({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-11 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-10 w-32 animate-pulse rounded-full bg-slate-100" />
      </CardContent>
    </Card>
  );
}

export default function AdminSettingsLoadingPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SectionHeading title="Workspace Settings" />
        <div className="h-5 w-full max-w-2xl animate-pulse rounded-full bg-slate-100" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <LoadingCard title="Workspace Identity" />
        <LoadingCard title="Recent Admin Activity" />
      </div>
    </div>
  );
}
