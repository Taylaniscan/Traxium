"use client";

import Link from "next/link";
import type { OrganizationRole } from "@prisma/client";

import { LoadSampleDataButton } from "@/components/onboarding/load-sample-data-button";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FirstValueLaunchpadProps = {
  viewerMembershipRole: OrganizationRole;
  title?: string;
  description?: string;
  primaryActionLabel?: string;
  reviewSetupLabel?: string;
};

export function FirstValueLaunchpad({
  viewerMembershipRole,
  title = "Fastest path to first value",
  description = "Start with one real savings initiative. You can complete master data later.",
  primaryActionLabel = "Create first saving card",
  reviewSetupLabel = "Review readiness",
}: FirstValueLaunchpadProps) {
  const canManageMembers =
    viewerMembershipRole === "OWNER" || viewerMembershipRole === "ADMIN";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4 text-sm leading-6 text-[var(--muted-foreground)]">
          Use sample data only for demo/training. Use real data when preparing a
          pilot or customer workspace.
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/saving-cards/new" className={buttonVariants({ size: "sm" })}>
            {primaryActionLabel}
          </Link>
          <LoadSampleDataButton size="sm">Load sample data</LoadSampleDataButton>
          <Link
            href="/onboarding"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {reviewSetupLabel}
          </Link>
          <Link
            href="/admin/members"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Invite team members in Admin Members
          </Link>
        </div>

        {!canManageMembers ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--muted-foreground)]">
            Team invitations are managed by workspace owners and admins. Ask a
            workspace admin to invite finance approvers and procurement leads.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
