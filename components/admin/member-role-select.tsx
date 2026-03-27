"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrganizationRole } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  captureException,
  trackClientEvent,
} from "@/lib/observability";
import { Select } from "@/components/ui/select";

type MemberRoleSelectProps = {
  membershipId: string;
  memberName: string;
  currentRole: OrganizationRole;
  viewerMembershipRole: OrganizationRole;
  viewerMembershipId: string;
};

type RoleUpdateErrorPayload = {
  error?: string;
};

const OWNER_ROLE_OPTIONS: OrganizationRole[] = ["OWNER", "ADMIN", "MEMBER"];
const ADMIN_ROLE_OPTIONS: OrganizationRole[] = ["ADMIN", "MEMBER"];

function formatRoleLabel(role: OrganizationRole) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function MemberRoleSelect({
  membershipId,
  memberName,
  currentRole,
  viewerMembershipRole,
  viewerMembershipId,
}: MemberRoleSelectProps) {
  const router = useRouter();
  const [nextRole, setNextRole] = useState<OrganizationRole>(currentRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    setNextRole(currentRole);
    setError(null);
    inFlightRef.current = false;
  }, [currentRole]);

  const isSelfMembership = membershipId === viewerMembershipId;
  const isOwnerTarget = currentRole === "OWNER";
  const isOwnerViewer = viewerMembershipRole === "OWNER";
  const roleOptions = isOwnerViewer ? OWNER_ROLE_OPTIONS : ADMIN_ROLE_OPTIONS;
  const disabledReason = isSelfMembership
    ? "Your own role must be changed by another workspace admin or owner."
    : !isOwnerViewer && isOwnerTarget
      ? "Only workspace owners can change owner access."
      : null;
  const canEdit = !disabledReason;

  async function handleUpdate() {
    if (!canEdit || nextRole === currentRole || inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/members/${membershipId}/role`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          role: nextRole,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as RoleUpdateErrorPayload | null;
        trackClientEvent(
          {
            event: "admin.members.role_update.rejected",
            message: payload?.error ?? `Role for ${memberName} could not be updated.`,
            payload: {
              membershipId,
              nextRole,
              status: response.status,
            },
          },
          "warn"
        );
        setError(payload?.error ?? `Role for ${memberName} could not be updated.`);
        inFlightRef.current = false;
        setLoading(false);
        return;
      }

      inFlightRef.current = false;
      setLoading(false);
      router.refresh();
    } catch (requestError) {
      captureException(requestError, {
        event: "admin.members.role_update.failed",
        runtime: "client",
        payload: {
          membershipId,
          nextRole,
        },
      });
      setError(
        requestError instanceof Error
          ? requestError.message
          : `Role for ${memberName} could not be updated.`
      );
      inFlightRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Select
          aria-label={`Update role for ${memberName}`}
          value={nextRole}
          onChange={(event) => setNextRole(event.target.value as OrganizationRole)}
          disabled={!canEdit || loading}
          className="min-w-[10rem]"
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {formatRoleLabel(role)}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleUpdate}
          disabled={!canEdit || loading || nextRole === currentRole}
        >
          {loading ? "Updating..." : "Update"}
        </Button>
      </div>

      {disabledReason ? (
        <p className="text-xs text-[var(--muted-foreground)]">{disabledReason}</p>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
