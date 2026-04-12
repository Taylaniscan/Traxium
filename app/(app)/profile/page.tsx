import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { roleLabels } from "@/lib/constants";
import { canManageOrganizationMembers } from "@/lib/organizations";

export default async function ProfilePage() {
  const user = await requireUser();
  const canViewWorkspaceSettings = canManageOrganizationMembers(
    user.activeOrganization.membershipRole
  );

  return (
    <div className="space-y-6">
      <SectionHeading title="Profile" />

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Profil Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <ProfileField label="Name" value={user.name} />
          <ProfileField label="Role" value={roleLabels[user.role as keyof typeof roleLabels]} />
          <ProfileField label="Email" value={user.email} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Hızlı Bağlantılar
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <QuickLinkCard
            href="/saving-cards"
            title="Saving Kartlarım"
            description="Tüm saving kartları açın ve buyer görünümünden ilerleyin."
          />
          <QuickLinkCard
            href="/open-actions"
            title="Bekleyen Onaylarım"
            description="Üzerinizdeki açık onay ve faz değişikliği isteklerini inceleyin."
          />
          {canViewWorkspaceSettings ? (
            <QuickLinkCard
              href="/admin"
              title="Çalışma Alanı Ayarları"
              description="Üyeler, ayarlar ve workspace yönetim ekranlarına gidin."
            />
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Klavye Kısayolları
        </h2>
        <Card className="max-w-3xl bg-[var(--muted)]/25">
          <CardContent className="grid gap-3 px-5 py-5">
            <ShortcutRow keyLabel="N" action="Yeni saving card oluştur" />
            <ShortcutRow keyLabel="D" action="Dashboard'a git" />
            <ShortcutRow keyLabel="K" action="Kanban'a git" />
            <ShortcutRow keyLabel="O" action="Açık onaylara git" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--muted)] p-4">
      <p className="text-xs font-semibold text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 break-all font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function QuickLinkCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition hover:border-[var(--primary)] hover:bg-[var(--muted)]/20">
        <CardContent className="space-y-2 px-5 py-5">
          <p className="font-semibold text-[var(--foreground)]">{title}</p>
          <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function ShortcutRow({
  keyLabel,
  action,
}: {
  keyLabel: string;
  action: string;
}) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-center gap-3 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
      <span className="inline-flex w-fit items-center rounded-md border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--foreground)]">
        {keyLabel}
      </span>
      <span className="text-sm text-[var(--foreground)]">{action}</span>
    </div>
  );
}
