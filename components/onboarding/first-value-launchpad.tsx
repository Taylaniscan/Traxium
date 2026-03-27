"use client";

import Link from "next/link";
import { useState } from "react";
import type { OrganizationRole } from "@prisma/client";
import { LoadSampleDataButton } from "@/components/onboarding/load-sample-data-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const INVITATION_ROLE_OPTIONS: Record<OrganizationRole, Array<{ value: OrganizationRole; label: string }>> = {
  OWNER: [
    { value: "OWNER", label: "Owner" },
    { value: "ADMIN", label: "Admin" },
    { value: "MEMBER", label: "Member" },
  ],
  ADMIN: [
    { value: "ADMIN", label: "Admin" },
    { value: "MEMBER", label: "Member" },
  ],
  MEMBER: [
    { value: "MEMBER", label: "Member" },
  ],
};

type FirstValueLaunchpadProps = {
  viewerMembershipRole: OrganizationRole;
};

type InvitationCreateResponse = {
  invitation: {
    token: string;
  };
  delivery:
    | {
        channel: "invite" | "magic_link";
        redirectTo: string;
        transport: "supabase-auth" | "generated-link";
        actionLink?: string;
        requiresManualDelivery?: boolean;
      }
    | {
        transport: "job-queued";
        state: "queued";
        jobId: string;
      }
    | {
        transport: "queue-unavailable";
        state: "unavailable";
      };
};

type InvitationCreateError = {
  error?: string;
};

export function FirstValueLaunchpad({
  viewerMembershipRole,
}: FirstValueLaunchpadProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>(
    viewerMembershipRole === "OWNER" ? "ADMIN" : "MEMBER"
  );
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const canInviteTeam =
    viewerMembershipRole === "OWNER" || viewerMembershipRole === "ADMIN";
  const roleOptions = INVITATION_ROLE_OPTIONS[viewerMembershipRole];

  async function handleInviteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteLoading(true);
    setInviteError(null);
    setInviteLink(null);
    setInviteSuccess(null);
    setCopyState("idle");

    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email,
          role,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as InvitationCreateError | null;
        setInviteError(payload?.error ?? "Invitation could not be created.");
        setInviteLoading(false);
        return;
      }

      const payload = (await response.json()) as InvitationCreateResponse;
      const nextInviteLink =
        "actionLink" in payload.delivery
          ? payload.delivery.actionLink ?? payload.delivery.redirectTo
          : null;

      setInviteLink(nextInviteLink);
      setInviteSuccess(
        payload.delivery.transport === "job-queued"
          ? "Invitation queued. The teammate will receive an email shortly."
          : payload.delivery.transport === "queue-unavailable"
            ? "Invitation created, but background email delivery is temporarily unavailable. Retry from Members shortly."
          : payload.delivery.transport === "generated-link"
            ? "Supabase email delivery is unavailable right now. Share this secure invite link directly."
            : payload.delivery.channel === "invite"
              ? "Invitation email sent. The teammate can complete account setup from the email."
              : "Invitation sign-in email sent. The teammate can open the email to join this workspace."
      );
      setEmail("");
      setRole(viewerMembershipRole === "OWNER" ? "ADMIN" : "MEMBER");
      setInviteLoading(false);
    } catch (error) {
      setInviteError(
        error instanceof Error ? error.message : "Invitation could not be created."
      );
      setInviteLoading(false);
    }
  }

  async function handleCopyInviteLink() {
    if (!inviteLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fastest Path To First Value</CardTitle>
        <CardDescription>
          Launch one real record, load a safe sample portfolio, or invite the next teammate without leaving the workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link href="/saving-cards/new" className={buttonVariants({ size: "sm" })}>
            Start first record
          </Link>
          <LoadSampleDataButton size="sm">Load sample data</LoadSampleDataButton>
          <Link
            href="/admin"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Review setup
          </Link>
        </div>

        {canInviteTeam ? (
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Invite teammate
              </h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Traxium queues invitation delivery in the background so workspace setup stays responsive.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="first-value-invite-email">Email</Label>
                <Input
                  id="first-value-invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="teammate@company.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first-value-invite-role">Role</Label>
                <Select
                  id="first-value-invite-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as OrganizationRole)}
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" disabled={inviteLoading}>
                {inviteLoading ? "Creating invite..." : "Create invite"}
              </Button>
            </div>

            {inviteError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {inviteError}
              </div>
            ) : null}

            {inviteSuccess ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                {inviteSuccess}
              </div>
            ) : null}

            {inviteLink ? (
              <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Secure invite link
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Keep this as a backup. Acceptance is still restricted to the invited email address.
                  </p>
                </div>
                <div className="flex flex-col gap-3 md:flex-row">
                  <Input value={inviteLink} readOnly className="font-mono text-xs" />
                  <Button type="button" variant="outline" onClick={handleCopyInviteLink}>
                    {copyState === "copied"
                      ? "Copied"
                      : copyState === "failed"
                        ? "Copy failed"
                        : "Copy link"}
                  </Button>
                </div>
              </div>
            ) : null}
          </form>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4 text-sm text-[var(--muted-foreground)]">
            Team invitations are managed by workspace owners and admins. If you need broader access, ask a workspace admin to invite the next teammate.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
