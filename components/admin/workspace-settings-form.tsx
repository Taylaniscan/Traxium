"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { OrganizationSettingsSummary } from "@/lib/organizations";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  captureException,
  trackClientEvent,
} from "@/lib/observability";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supportedLocales } from "@/lib/regional";

const FISCAL_YEAR_MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
] as const;

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
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(
    organization.fiscalYearStartMonth
  );
  const [defaultCurrency, setDefaultCurrency] = useState(
    organization.defaultCurrency
  );
  const [multiCurrencyEnabled, setMultiCurrencyEnabled] = useState(
    organization.multiCurrencyEnabled
  );
  const [reportingCurrency, setReportingCurrency] = useState(organization.reportingCurrency);
  const [locale, setLocale] = useState(organization.locale);
  const [timeZone, setTimeZone] = useState(organization.timeZone);
  const [measurementSystem, setMeasurementSystem] = useState(organization.measurementSystem);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    setName(organization.name);
    setDescription(organization.description ?? "");
    setFiscalYearStartMonth(organization.fiscalYearStartMonth);
    setDefaultCurrency(organization.defaultCurrency);
    setMultiCurrencyEnabled(organization.multiCurrencyEnabled);
    setReportingCurrency(organization.reportingCurrency);
    setLocale(organization.locale);
    setTimeZone(organization.timeZone);
    setMeasurementSystem(organization.measurementSystem);
    inFlightRef.current = false;
  }, [
    organization.description,
    organization.name,
    organization.fiscalYearStartMonth,
    organization.defaultCurrency,
    organization.multiCurrencyEnabled,
    organization.reportingCurrency,
    organization.locale,
    organization.timeZone,
    organization.measurementSystem,
  ]);

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
          fiscalYearStartMonth,
          defaultCurrency,
          multiCurrencyEnabled,
          reportingCurrency,
          locale,
          timeZone,
          measurementSystem,
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
        setFiscalYearStartMonth(payload.organization.fiscalYearStartMonth);
        setDefaultCurrency(payload.organization.defaultCurrency);
        setMultiCurrencyEnabled(payload.organization.multiCurrencyEnabled);
        setReportingCurrency(payload.organization.reportingCurrency);
        setLocale(payload.organization.locale);
        setTimeZone(payload.organization.timeZone);
        setMeasurementSystem(payload.organization.measurementSystem);
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Workspace Identity</CardTitle>
          <CardDescription>
            Update the active organization name and short description used across admin surfaces.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
            <p className="text-xs text-[var(--muted-foreground)]">
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

            <div className="space-y-2">
              <Label htmlFor="fiscal-year-start-month">Fiscal year start month</Label>
              <Select
                id="fiscal-year-start-month"
                value={fiscalYearStartMonth}
                onChange={(event) =>
                  setFiscalYearStartMonth(Number(event.target.value))
                }
              >
                {FISCAL_YEAR_MONTHS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-[var(--muted-foreground)]">
                Controls how in-year savings value is prorated. Cards with mid-year impact
                start dates count only the months that fall inside this fiscal year.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-currency">Default currency</Label>
              <Select
                id="default-currency"
                value={defaultCurrency}
                onChange={(event) =>
                  setDefaultCurrency(event.target.value as typeof defaultCurrency)
                }
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </Select>
              <p className="text-xs text-[var(--muted-foreground)]">
                New saving cards use this currency. Currency is independent of location, display format, and units.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reporting-currency">Reporting currency</Label>
              <Select id="reporting-currency" value={reportingCurrency} onChange={(event) => setReportingCurrency(event.target.value as typeof reportingCurrency)}>
                <option value="USD">USD</option><option value="EUR">EUR</option>
              </Select>
              <p className="text-xs text-[var(--muted-foreground)]">Changing this display basis does not alter card currencies, finance approvals, or historical FX records. A valid EUR-to-USD rate is needed for EUR reporting.</p>
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={multiCurrencyEnabled}
                  onChange={(event) => setMultiCurrencyEnabled(event.target.checked)}
                />
                <span>
                  <span className="block text-[13px] font-medium text-[var(--foreground)]">
                    Enable multi-currency
                  </span>
                  <span className="block text-xs text-[var(--muted-foreground)]">
                    When off, saving cards use the workspace default currency: they never show a currency
                    or FX rate field. Turn this on only if buyers transact in more than one
                    currency.
                  </span>
                </span>
              </label>
            </div>

            <fieldset className="space-y-4 rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">Regional preferences</legend>
              <div className="space-y-2"><Label htmlFor="workspace-locale">Number and date display locale</Label><Input id="workspace-locale" list="workspace-locales" value={locale} onChange={(event) => setLocale(event.target.value)} placeholder="en-US" /><datalist id="workspace-locales">{supportedLocales.map((item) => <option key={item} value={item} />)}</datalist><p className="text-xs text-[var(--muted-foreground)]">Use a locale code such as en-US, de-DE, or ja-JP. The interface stays in English.</p></div>
              <div className="space-y-2"><Label htmlFor="workspace-time-zone">Time zone (IANA)</Label><Input id="workspace-time-zone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} placeholder="Europe/Amsterdam" /><p className="text-xs text-[var(--muted-foreground)]">Used to display event timestamps. Impact dates stay on their stored calendar date.</p></div>
              <div className="space-y-2"><Label htmlFor="measurement-system">Suggested units</Label><Select id="measurement-system" value={measurementSystem} onChange={(event) => setMeasurementSystem(event.target.value)}><option value="metric">Metric</option><option value="us_customary">US customary</option></Select><p className="text-xs text-[var(--muted-foreground)]">Suggestions only. Stored card quantities and units do not change.</p></div>
            </fieldset>

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

      <Card>
        <CardHeader>
          <CardTitle>Guided setup wizard</CardTitle>
          <CardDescription>
            Reopen the guided setup wizard to review master data, first-value progress, team setup, and readiness.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/onboarding"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Return to onboarding wizard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
