"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  captureException,
  trackClientEvent,
} from "@/lib/observability";

type WorkspaceOnboardingFormProps = {
  userName: string;
};

type WorkspaceOnboardingErrorPayload = {
  error?: string;
  code?: string;
};

export function WorkspaceOnboardingForm({
  userName,
}: WorkspaceOnboardingFormProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submissionInFlightRef = useRef(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submissionInFlightRef.current) {
      return;
    }

    submissionInFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding/workspace", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as WorkspaceOnboardingErrorPayload | null;

        if (response.status === 409) {
          trackClientEvent(
            {
              event: "onboarding.workspace.conflict",
              message: payload?.error ?? "Workspace already exists.",
            },
            "warn"
          );
          window.location.assign("/onboarding");
          return;
        }

        trackClientEvent(
          {
            event: "onboarding.workspace.rejected",
            message: payload?.error ?? "Workspace could not be created.",
            payload: {
              code: payload?.code ?? null,
              status: response.status,
            },
          },
          "warn"
        );
        setError(payload?.error ?? "Workspace could not be created.");
        submissionInFlightRef.current = false;
        setLoading(false);
        return;
      }

      window.location.assign("/onboarding");
    } catch (submissionError) {
      captureException(submissionError, {
        event: "onboarding.workspace.failed",
        runtime: "client",
      });
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Workspace could not be created."
      );
      submissionInFlightRef.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] p-6 text-[var(--foreground)]">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-[rgba(37,99,235,0.16)] bg-[rgba(37,99,235,0.08)] px-3 py-1 text-xs font-semibold tracking-[0.12em] text-[var(--info)]">
                Guided setup
              </span>
              <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold tracking-[0.12em] text-[var(--muted-foreground)]">
                Step 1 of 7
              </span>
            </div>
            <CardTitle>Create your first workspace</CardTitle>
            <CardDescription>
              Start with the workspace name. As soon as this step is done, Traxium will move you into a guided setup flow for upload-first master data, the first saving card, and team expansion.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
              Signed in as <span className="font-medium text-[var(--foreground)]">{userName}</span>
            </div>

            <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                    Progress
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">14%</p>
                </div>
                <div className="text-right text-sm text-[var(--muted-foreground)]">
                  Naming the workspace unlocks the rest of the guided setup.
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                <div className="h-full w-[14%] rounded-full bg-[var(--primary)]" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace name</Label>
                <Input
                  id="workspace-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="organization"
                  required
                />
                <p className="text-sm text-[var(--muted-foreground)]">
                  This becomes the first organization for your account and sets your active workspace context for the rest of the setup wizard.
                </p>
              </div>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !name.trim()}
              >
                {loading ? "Creating workspace..." : "Create workspace"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What happens next</CardTitle>
            <CardDescription>
              The onboarding wizard keeps the first-value path visible after this first step, so setup feels like progress instead of admin overhead.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Workspace basics",
              "Upload buyers",
              "Upload suppliers",
              "Upload materials",
              "Upload categories",
              "Create first saving card",
              "Invite teammate or load sample data",
            ].map((step, index) => (
              <div
                key={step}
                className={`rounded-2xl border px-4 py-4 ${
                  index === 0
                    ? "border-[rgba(37,99,235,0.2)] bg-[rgba(37,99,235,0.06)]"
                    : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                      index === 0
                        ? "border-[rgba(37,99,235,0.2)] bg-white text-[var(--info)]"
                        : "border-[var(--border)] bg-[var(--muted)]/55 text-[var(--muted-foreground)]"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {step}
                    </p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {index === 0
                        ? "Current step"
                        : "Available in the guided setup right after workspace creation"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
