import type {
  InvitationStatus,
  MembershipStatus,
  OrganizationRole,
} from "@prisma/client";

import type {
  OrganizationDirectoryMember,
  OrganizationDirectoryPendingInvite,
} from "@/lib/organizations";
import { InvitationActions } from "@/components/admin/invitation-actions";
import { MemberRoleSelect } from "@/components/admin/member-role-select";
import { MemberRemoveButton } from "@/components/admin/member-remove-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type MembersManagementPanelProps = {
  members: OrganizationDirectoryMember[];
  pendingInvites: OrganizationDirectoryPendingInvite[];
  viewerMembershipId: string;
  viewerMembershipRole: OrganizationRole;
};

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(value);
}

function roleTone(role: OrganizationRole) {
  switch (role) {
    case "OWNER":
      return "amber";
    case "ADMIN":
      return "blue";
    default:
      return "slate";
  }
}

function membershipTone(status: MembershipStatus) {
  switch (status) {
    case "ACTIVE":
      return "emerald";
    case "INVITED":
      return "blue";
    case "SUSPENDED":
      return "rose";
    default:
      return "slate";
  }
}

function invitationTone(status: InvitationStatus) {
  switch (status) {
    case "PENDING":
      return "amber";
    case "ACCEPTED":
      return "emerald";
    case "REVOKED":
      return "rose";
    case "EXPIRED":
      return "slate";
    default:
      return "slate";
  }
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted)]/25 px-5 py-8 text-sm text-[var(--muted-foreground)]">
      <p className="font-medium text-[var(--foreground)]">{title}</p>
      <p className="mt-2">{description}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

function MembersTable({
  members,
  viewerMembershipId,
  viewerMembershipRole,
}: {
  members: OrganizationDirectoryMember[];
  viewerMembershipId: string;
  viewerMembershipRole: OrganizationRole;
}) {
  if (!members.length) {
    return (
      <EmptyState
        title="No members in this organization yet"
        description="Members will appear here as soon as the current workspace has accepted users or completed tenant onboarding."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
      <Table>
        <TableHead>
          <TableRow className="hover:bg-transparent odd:bg-transparent">
            <TableHeaderCell>Member</TableHeaderCell>
            <TableHeaderCell>Role</TableHeaderCell>
            <TableHeaderCell>Membership</TableHeaderCell>
            <TableHeaderCell>Joined</TableHeaderCell>
            <TableHeaderCell>Account Created</TableHeaderCell>
            <TableHeaderCell>Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                <div className="space-y-1">
                  <p className="font-medium text-[var(--foreground)]">{member.name}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">{member.email}</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-2">
                  <Badge tone={roleTone(member.role)}>{formatLabel(member.role)}</Badge>
                  <MemberRoleSelect
                    membershipId={member.id}
                    memberName={member.name}
                    currentRole={member.role}
                    viewerMembershipId={viewerMembershipId}
                    viewerMembershipRole={viewerMembershipRole}
                  />
                </div>
              </TableCell>
              <TableCell>
                <Badge tone={membershipTone(member.membershipStatus)}>
                  {formatLabel(member.membershipStatus)}
                </Badge>
              </TableCell>
              <TableCell>{formatDateLabel(member.joinedAt)}</TableCell>
              <TableCell>{formatDateLabel(member.createdAt)}</TableCell>
              <TableCell>
                <MemberRemoveButton
                  membershipId={member.id}
                  memberName={member.name}
                  disabled={member.id === viewerMembershipId}
                  disabledReason={
                    member.id === viewerMembershipId
                      ? "Use another workspace admin or owner to remove your access."
                      : null
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PendingInvitesTable({
  pendingInvites,
}: {
  pendingInvites: OrganizationDirectoryPendingInvite[];
}) {
  if (!pendingInvites.length) {
    return (
      <EmptyState
        title="No pending invitations"
        description="Open invitations for the active workspace will appear here until they are accepted, revoked, or expire."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
      <Table>
        <TableHead>
          <TableRow className="hover:bg-transparent odd:bg-transparent">
            <TableHeaderCell>Invitee</TableHeaderCell>
            <TableHeaderCell>Role</TableHeaderCell>
            <TableHeaderCell>Invite Status</TableHeaderCell>
            <TableHeaderCell>Invited By</TableHeaderCell>
            <TableHeaderCell>Sent</TableHeaderCell>
            <TableHeaderCell>Expires</TableHeaderCell>
            <TableHeaderCell>Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pendingInvites.map((invite) => (
            <TableRow key={invite.id}>
              <TableCell>
                <div className="space-y-1">
                  <p className="font-medium text-[var(--foreground)]">{invite.email}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Waiting for account completion or acceptance.
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <Badge tone={roleTone(invite.role)}>{formatLabel(invite.role)}</Badge>
              </TableCell>
              <TableCell>
                <Badge tone={invitationTone(invite.inviteStatus)}>
                  {formatLabel(invite.inviteStatus)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <p className="font-medium text-[var(--foreground)]">{invite.invitedBy.name}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">{invite.invitedBy.email}</p>
                </div>
              </TableCell>
              <TableCell>{formatDateLabel(invite.invitedAt)}</TableCell>
              <TableCell>{formatDateLabel(invite.expiresAt)}</TableCell>
              <TableCell>
                <InvitationActions
                  invitationId={invite.id}
                  inviteeEmail={invite.email}
                  inviteStatus={invite.inviteStatus}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function MembersManagementPanel({
  members,
  pendingInvites,
  viewerMembershipId,
  viewerMembershipRole,
}: MembersManagementPanelProps) {
  const adminCount = members.filter(
    (member) => member.role === "OWNER" || member.role === "ADMIN"
  ).length;
  const activeMembersCount = members.filter(
    (member) => member.membershipStatus === "ACTIVE"
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Active Members"
          value={String(activeMembersCount)}
          detail="Users with an active membership in the currently selected workspace."
        />
        <SummaryCard
          label="Admins And Owners"
          value={String(adminCount)}
          detail="Users who can manage workspace-level access for this tenant."
        />
        <SummaryCard
          label="Pending Invites"
          value={String(pendingInvites.length)}
          detail="Open invitations that still belong to this active organization."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workspace Members</CardTitle>
          <CardDescription>
            Tenant-scoped membership records for the currently active organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MembersTable
            members={members}
            viewerMembershipId={viewerMembershipId}
            viewerMembershipRole={viewerMembershipRole}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>
            Invitations that are still waiting to be accepted inside this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PendingInvitesTable pendingInvites={pendingInvites} />
        </CardContent>
      </Card>
    </div>
  );
}
