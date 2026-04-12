import Link from "next/link";

import { InvitationFlow } from "@/components/invitations/invitation-flow";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getInvitationByToken, getInvitationReadError } from "@/lib/invitations";

function buildInviteLoginHref(token: string, email: string) {
  return `/login?next=${encodeURIComponent(`/invite/${token}?mode=accept`)}&email=${encodeURIComponent(email)}&message=invite-sign-in`;
}

function formatRoleLabel(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function InvitePage(
  {
    params,
    searchParams,
  }: {
    params: Promise<{ token: string }>;
    searchParams: Promise<{ mode?: string | string[] }>;
  }
) {
  const { token } = await params;
  const { mode } = await searchParams;
  const invitation = await getInvitationByToken(token);
  const nextMode =
    mode === "setup" || mode === "accept"
      ? mode
      : Array.isArray(mode) && (mode[0] === "setup" || mode[0] === "accept")
        ? mode[0]
        : "setup";

  if (!invitation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-xl shadow-sm">
          <CardHeader>
            <CardTitle>Invitation not found</CardTitle>
            <CardDescription>
              The invitation link is invalid or no longer available.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const invitationError = getInvitationReadError(invitation);
  const loginHref = buildInviteLoginHref(token, invitation.email);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Workspace invitation</CardTitle>
          <CardDescription>
            Review the invitation details before joining this organization.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <dt className="text-xs font-medium text-slate-500">Organization</dt>
              <dd className="mt-2 text-sm font-medium text-slate-900">{invitation.organization.name}</dd>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <dt className="text-xs font-medium text-slate-500">Invited role</dt>
              <dd className="mt-2 text-sm font-medium text-slate-900">{formatRoleLabel(invitation.role)}</dd>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <dt className="text-xs font-medium text-slate-500">Invitation email</dt>
              <dd className="mt-2 text-sm font-medium text-slate-900">{invitation.email}</dd>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <dt className="text-xs font-medium text-slate-500">Expires</dt>
              <dd className="mt-2 text-sm font-medium text-slate-900">{formatDateLabel(invitation.expiresAt)}</dd>
            </div>
          </dl>

          {invitationError ? (
            <div className="space-y-4">
              <div className="rounded-md border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
                {invitationError.message}
              </div>

              <Link
                href={invitationError.status === 409 ? "/dashboard" : loginHref}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              >
                {invitationError.status === 409 ? "Go to dashboard" : "Go to sign in"}
              </Link>
            </div>
          ) : null
          }

          {!invitationError ? (
            <InvitationFlow
              token={token}
              mode={nextMode}
              invitation={{
                id: invitation.id,
                email: invitation.email,
                role: invitation.role,
                status: invitation.status,
                expiresAt: invitation.expiresAt.toISOString(),
                organization: invitation.organization,
                invitedBy: invitation.invitedBy,
              }}
              loginHref={loginHref}
            />
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
