"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          window.location.assign("/dashboard");
          return;
        }

        setError(payload?.error ?? "Workspace could not be created.");
        setLoading(false);
        return;
      }

      window.location.assign("/dashboard");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Workspace could not be created."
      );
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-lg shadow-sm">
        <CardHeader>
          <CardTitle>Create your first workspace</CardTitle>
          <CardDescription>
            Set up the organization boundary that will own your saving cards,
            approvals, master data, and reporting.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mb-6 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Signed in as <span className="font-medium text-slate-900">{userName}</span>
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
              <p className="text-sm text-slate-500">
                This becomes the first organization for your account and sets
                your active workspace context.
              </p>
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating workspace..." : "Create workspace"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
