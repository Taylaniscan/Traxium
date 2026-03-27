"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { OrganizationSettingsSummary } from "@/lib/organizations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  captureException,
  trackClientEvent,
} from "@/lib/observability";
import { Textarea } from "@/components/ui/textarea";

type WorkspaceSettingsFormProps = {
  organization: OrganizationSettingsSummary;
};

type WorkspaceSettingsErrorPayload = {
  error?: string;
};

export function WorkspaceSettingsForm({
  organization,
}: WorkspaceSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(organization.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    setName(organization.name);
    setDescription(organization.description ?? "");
    inFlightRef.current = false;
  }, [organization.description, organization.name]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as WorkspaceSettingsErrorPayload | null;
        trackClientEvent(
          {
            event: "admin.settings.update.rejected",
            message: payload?.error ?? "Workspace settings could not be saved.",
            payload: {
              organizationId: organization.id,
              status: response.status,
            },
          },
          "warn"
        );
        setError(payload?.error ?? "Workspace settings could not be saved.");
        inFlightRef.current = false;
        setLoading(false);
        return;
      }

      const payload = (await response.json()) as {
        message?: string;
        organization?: OrganizationSettingsSummary;
      };

      setNotice(payload.message ?? "Workspace settings saved.");
      if (payload.organization) {
        setName(payload.organization.name);
        setDescription(payload.organization.description ?? "");
      }
      inFlightRef.current = false;
      setLoading(false);
      router.refresh();
    } catch (requestError) {
      captureException(requestError, {
        event: "admin.settings.update.failed",
        runtime: "client",
        organizationId: organization.id,
      });
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Workspace settings could not be saved."
      );
      inFlightRef.current = false;
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace Identity</CardTitle>
        <CardDescription>
          Update the active organization name and short description used across admin surfaces.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            Workspace Slug
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
            {organization.slug}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-description">Short description</Label>
            <Textarea
              id="workspace-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={240}
              rows={4}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Optional internal description shown to admins when managing the active workspace.
            </p>
          </div>

          {notice ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {notice}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={loading || !name.trim()}
          >
            {loading ? "Saving..." : "Save settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
