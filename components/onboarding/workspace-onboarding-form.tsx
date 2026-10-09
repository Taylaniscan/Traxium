"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown, Globe2, Loader2 } from "lucide-react";
import {
  OnboardingShell,
  onboardingPrimaryClass,
} from "@/components/onboarding/onboarding-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  normalizeLocale,
  normalizeTimeZone,
  supportedLocales,
} from "@/lib/regional";
import { captureException, trackClientEvent } from "@/lib/observability";
import { Textarea } from "@/components/ui/textarea";

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
  const [description, setDescription] = useState("");
  const [locale, setLocale] = useState("en-US");
  const [timeZone, setTimeZone] = useState("UTC");
  const [measurementSystem, setMeasurementSystem] = useState<
    "metric" | "us_customary"
  >("metric");
  useEffect(() => {
    const browserLocale = navigator.language;
    setLocale(normalizeLocale(browserLocale) ?? "en-US");
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submissionInFlightRef = useRef(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submissionInFlightRef.current) {
      return;
    }

    if (name.trim().length < 2) {
      setError("Use at least two characters for your workspace name.");
      return;
    }
    if (!normalizeLocale(locale) || !normalizeTimeZone(timeZone)) {
      setError(
        "Check the display format and time zone in Regional preferences.",
      );
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
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          locale,
          timeZone,
          measurementSystem,
        }),
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as WorkspaceOnboardingErrorPayload | null;

        if (response.status === 409) {
          trackClientEvent(
            {
              event: "onboarding.workspace.conflict",
              message: payload?.error ?? "Workspace already exists.",
            },
            "warn",
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
          "warn",
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
          : "Workspace could not be created.",
      );
      submissionInFlightRef.current = false;
      setLoading(false);
    }
  }

  return (
    <OnboardingShell step={1}>
      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#36826d]">
          STEP 1 OF 3 · THE BASICS
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
          Make room for better savings.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-7 text-[#6a7e83]">
          Welcome, {userName.trim().split(/\s+/u)[0] || "there"}. Give your team
          a workspace. You can add your first savings initiative next.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[#e1e8e8] bg-white shadow-[0_8px_32px_-16px_rgba(27,45,50,0.15)]"
        aria-busy={loading}
      >
        <fieldset disabled={loading} className="space-y-7 p-6 sm:p-8">
          <div className="space-y-2.5">
            <Label htmlFor="workspace-name" className="text-sm font-semibold">
              Workspace name
            </Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="organization"
              placeholder="e.g. Northstar Procurement"
              minLength={2}
              maxLength={80}
              className="h-12 rounded-xl text-sm"
              aria-describedby="workspace-name-help"
              required
            />
            <p
              id="workspace-name-help"
              className="text-xs leading-5 text-[#5b7075]"
            >
              Your company or team name works well. You can change it later.
            </p>
          </div>

          <details className="group rounded-xl border border-[#e4eaea]">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155e52] [&::-webkit-details-marker]:hidden">
              <Globe2
                size={19}
                className="shrink-0 text-[#658379]"
                aria-hidden="true"
              />
              <span className="flex-1">
                <span className="block font-medium">Regional preferences</span>
                <span className="mt-1 block break-words text-xs text-[#5b7075]">
                  {locale} · {timeZone.replaceAll("_", " ")} ·{" "}
                  {measurementSystem === "metric" ? "Metric" : "US customary"}
                </span>
              </span>
              <ChevronDown
                size={16}
                className="shrink-0 text-[#5b7075] transition group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-5 border-t border-[#e4eaea] p-4">
              <p className="text-xs leading-6 text-[#6a7e83]">
                Suggested from your browser. These choices affect display and
                unit suggestions; your interface stays in English.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="onboarding-locale">Display format</Label>
                  <Input
                    id="onboarding-locale"
                    list="onboarding-locales"
                    value={locale}
                    onChange={(event) => setLocale(event.target.value)}
                    placeholder="en-US"
                  />
                  <datalist id="onboarding-locales">
                    {supportedLocales.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                  <p className="text-xs text-[#5b7075]">
                    For example: en-US, de-DE, or ja-JP.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onboarding-time-zone">Time zone</Label>
                  <Input
                    id="onboarding-time-zone"
                    value={timeZone}
                    onChange={(event) => setTimeZone(event.target.value)}
                    placeholder="Europe/Amsterdam"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboarding-units">Preferred units</Label>
                <Select
                  id="onboarding-units"
                  value={measurementSystem}
                  onChange={(event) =>
                    setMeasurementSystem(
                      event.target.value as "metric" | "us_customary",
                    )
                  }
                >
                  <option value="metric">
                    Metric — kilograms, litres, metres
                  </option>
                  <option value="us_customary">
                    US customary — pounds, US gallons, feet
                  </option>
                </Select>
              </div>
            </div>
          </details>

          <details className="group">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded text-xs font-medium text-[#637d77] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155e52] [&::-webkit-details-marker]:hidden">
              <ChevronDown
                size={14}
                className="transition group-open:rotate-180"
                aria-hidden="true"
              />{" "}
              Add a short description{" "}
              <span className="font-normal text-[#5b7075]">(optional)</span>
            </summary>
            <div className="mt-3 space-y-2">
              <Label htmlFor="workspace-description">
                What will your team track?
              </Label>
              <Textarea
                id="workspace-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={240}
                rows={3}
                placeholder="e.g. Savings across packaging and direct materials"
              />
            </div>
          </details>
        </fieldset>

        {error ? (
          <div
            role="alert"
            className="mx-6 mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-8"
          >
            {error}
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-4 border-t border-[#edf0f1] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-xs text-[#5b7075]">
            All you need to start is a name.
          </p>
          <Button
            type="submit"
            className={onboardingPrimaryClass}
            disabled={loading || name.trim().length < 2}
          >
            {loading ? (
              <>
                <Loader2
                  size={16}
                  className="animate-spin"
                  aria-hidden="true"
                />{" "}
                Creating workspace…
              </>
            ) : (
              <>
                Create workspace <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
