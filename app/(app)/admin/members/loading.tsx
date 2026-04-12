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
        <div className="h-11 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-11 animate-pulse rounded-2xl bg-slate-100" />
      </CardContent>
    </Card>
  );
}

export default function AdminMembersLoadingPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SectionHeading title="Members" />
        <div className="h-5 w-full max-w-2xl animate-pulse rounded-full bg-slate-100" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-28 animate-pulse rounded-2xl border border-[var(--border)] bg-white/70" />
        <div className="h-28 animate-pulse rounded-2xl border border-[var(--border)] bg-white/70" />
        <div className="h-28 animate-pulse rounded-2xl border border-[var(--border)] bg-white/70" />
      </div>

      <LoadingCard title="Workspace Members" />
      <LoadingCard title="Pending Invitations" />
    </div>
  );
}
