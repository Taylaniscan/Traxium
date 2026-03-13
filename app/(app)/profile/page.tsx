import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { roleLabels } from "@/lib/constants";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <SectionHeading title="Profile" />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <ProfileField label="Name" value={user.name} />
          <ProfileField label="Role" value={roleLabels[user.role as keyof typeof roleLabels]} />
          <ProfileField label="Email" value={user.email} />
          <ProfileField label="User ID" value={user.id} />
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--muted)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 break-all font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}
