import Link from "next/link";

import { InvitationAcceptancePanel } from "@/components/invitations/invitation-acceptance-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceOnboardingState } from "@/lib/auth";
import { getInvitationByToken, getInvitationReadError } from "@/lib/invitations";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function buildInviteLoginHref(token: string) {
  return `/login?next=${encodeURIComponent(`/invite/${token}`)}`;
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
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const [invitation, authState] = await Promise.all([
    getInvitationByToken(token),
    getWorkspaceOnboardingState(),
  ]);

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
  const signedInEmail = authState.ok ? authState.user.email : null;
  const emailsMatch =
    signedInEmail !== null &&
    normalizeEmail(signedInEmail) === normalizeEmail(invitation.email);
  const loginHref = buildInviteLoginHref(token);
  const canShowAcceptancePanel =
    !invitationError && (authState.ok || authState.code === "UNAUTHENTICATED");

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
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Organization</dt>
              <dd className="mt-2 text-sm font-medium text-slate-900">{invitation.organization.name}</dd>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Invited role</dt>
              <dd className="mt-2 text-sm font-medium text-slate-900">{formatRoleLabel(invitation.role)}</dd>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Invitation email</dt>
              <dd className="mt-2 text-sm font-medium text-slate-900">{invitation.email}</dd>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Expires</dt>
              <dd className="mt-2 text-sm font-medium text-slate-900">{formatDateLabel(invitation.expiresAt)}</dd>
            </div>
          </dl>

          {authState.ok ? null : authState.code === "UNAUTHENTICATED" ? null : (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {authState.message}
            </div>
          )}

          {invitationError ? (
            <div className="space-y-4">
              <div className="rounded-md border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
                {invitationError.message}
              </div>

              <Link
                href="/dashboard"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              >
                Go to dashboard
              </Link>
            </div>
          ) : canShowAcceptancePanel ? (
            <InvitationAcceptancePanel
              token={token}
              invitationEmail={invitation.email}
              signedInEmail={signedInEmail}
              canAccept={authState.ok && emailsMatch}
              loginHref={loginHref}
            />
          ) : null
          }
        </CardContent>
      </Card>
    </main>
  );
}
