"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  pilotCompanySizeOptions,
  pilotIndustryOptions,
  pilotLeadSubmissionSchema,
  pilotLeadSuccessMessage,
  pilotTimelineOptions,
  pilotTrackingOptions,
} from "@/lib/pilot-leads/validation";

type FieldErrors = Record<string, string>;

function FieldError({
  errors,
  field,
}: {
  errors: FieldErrors;
  field: string;
}) {
  const message = errors[field];

  if (!message) return null;

  return (
    <p className="text-xs font-medium text-[var(--destructive)]" role="alert">
      {message}
    </p>
  );
}

function SelectPlaceholder() {
  return <option value="">Select one</option>;
}

export function PilotLeadForm() {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      fullName: String(formData.get("fullName") ?? ""),
      workEmail: String(formData.get("workEmail") ?? ""),
      companyName: String(formData.get("companyName") ?? ""),
      jobTitle: String(formData.get("jobTitle") ?? ""),
      companySize: String(formData.get("companySize") ?? ""),
      industry: String(formData.get("industry") ?? ""),
      currentTracking: String(formData.get("currentTracking") ?? ""),
      savingsPain: String(formData.get("savingsPain") ?? ""),
      hasSavingsTracker: formData.get("hasSavingsTracker") === "yes",
      timeline: String(formData.get("timeline") ?? ""),
      message: String(formData.get("message") ?? ""),
      websiteUrl: String(formData.get("websiteUrl") ?? ""),
    };
    const validation = pilotLeadSubmissionSchema.safeParse(payload);

    if (!validation.success) {
      const errors: FieldErrors = {};

      for (const issue of validation.error.issues) {
        const field =
          typeof issue.path[0] === "string" ? issue.path[0] : "form";
        errors[field] ??= issue.message;
      }

      setFieldErrors(errors);
      setFormError(
        errors.form ?? "Review the highlighted fields and try again."
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/pilot-leads", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(validation.data),
      });
      const result = (await response.json().catch(() => null)) as
        | {
            error?: string;
            fieldErrors?: FieldErrors;
            message?: string;
          }
        | null;

      if (!response.ok) {
        setFieldErrors(result?.fieldErrors ?? {});
        setFormError(
          result?.error ??
            "Your pilot request could not be submitted right now. Please try again shortly."
        );
        return;
      }

      setSubmitted(true);
      form.reset();
    } catch {
      setFormError(
        "Your pilot request could not be submitted right now. Please check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="border-[rgba(31,107,77,0.24)] bg-[rgba(31,107,77,0.06)]">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--success)]">
            Request received
          </p>
          <CardTitle>Thank you for considering Traxium.</CardTitle>
          <CardDescription className="text-[var(--foreground)]">
            {pilotLeadSuccessMessage}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-[var(--muted-foreground)]">
            No account or workspace has been created. A guided pilot starts only
            after a fit review and an agreed scope.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
          Paid-pilot fit request
        </p>
        <CardTitle>Tell us about your savings process.</CardTitle>
        <CardDescription>
          Required fields are marked. Do not attach or paste sensitive
          procurement files here; a tracker review happens later through an
          agreed pilot process.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <div
            aria-hidden="true"
            className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden"
          >
            <Label htmlFor="websiteUrl">Company website</Label>
            <Input
              id="websiteUrl"
              name="websiteUrl"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name *</Label>
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                maxLength={100}
                aria-invalid={Boolean(fieldErrors.fullName)}
              />
              <FieldError errors={fieldErrors} field="fullName" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workEmail">Work email *</Label>
              <Input
                id="workEmail"
                name="workEmail"
                type="email"
                autoComplete="email"
                maxLength={254}
                aria-invalid={Boolean(fieldErrors.workEmail)}
              />
              <FieldError errors={fieldErrors} field="workEmail" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company name *</Label>
              <Input
                id="companyName"
                name="companyName"
                autoComplete="organization"
                maxLength={160}
                aria-invalid={Boolean(fieldErrors.companyName)}
              />
              <FieldError errors={fieldErrors} field="companyName" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input
                id="jobTitle"
                name="jobTitle"
                autoComplete="organization-title"
                maxLength={120}
                aria-invalid={Boolean(fieldErrors.jobTitle)}
              />
              <FieldError errors={fieldErrors} field="jobTitle" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companySize">Company size</Label>
              <Select
                id="companySize"
                name="companySize"
                aria-invalid={Boolean(fieldErrors.companySize)}
              >
                <SelectPlaceholder />
                {pilotCompanySizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <FieldError errors={fieldErrors} field="companySize" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select
                id="industry"
                name="industry"
                aria-invalid={Boolean(fieldErrors.industry)}
              >
                <SelectPlaceholder />
                {pilotIndustryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <FieldError errors={fieldErrors} field="industry" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currentTracking">
              How do you track procurement savings today?
            </Label>
            <Select
              id="currentTracking"
              name="currentTracking"
              aria-invalid={Boolean(fieldErrors.currentTracking)}
            >
              <SelectPlaceholder />
              {pilotTrackingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <FieldError errors={fieldErrors} field="currentTracking" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="savingsPain">
              Biggest savings review or reporting pain
            </Label>
            <Textarea
              id="savingsPain"
              name="savingsPain"
              maxLength={1_000}
              placeholder="For example: finance cannot trace assumptions and evidence across category savings trackers."
              aria-invalid={Boolean(fieldErrors.savingsPain)}
            />
            <FieldError errors={fieldErrors} field="savingsPain" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hasSavingsTracker">
                Existing savings tracker?
              </Label>
              <Select id="hasSavingsTracker" name="hasSavingsTracker" defaultValue="no">
                <option value="yes">Yes, we have one</option>
                <option value="no">No or not consistently</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeline">Pilot timing</Label>
              <Select
                id="timeline"
                name="timeline"
                aria-invalid={Boolean(fieldErrors.timeline)}
              >
                <SelectPlaceholder />
                {pilotTimelineOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <FieldError errors={fieldErrors} field="timeline" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Anything else we should know?</Label>
            <Textarea
              id="message"
              name="message"
              maxLength={1_500}
              placeholder="Optional context about your team, current review cycle, or pilot goals."
              aria-invalid={Boolean(fieldErrors.message)}
            />
            <FieldError errors={fieldErrors} field="message" />
          </div>

          {formError ? (
            <div
              className="rounded-lg border border-[rgba(185,28,28,0.22)] bg-[rgba(185,28,28,0.06)] px-4 py-3 text-sm text-[var(--destructive)]"
              role="alert"
            >
              {formError}
            </div>
          ) : null}

          <Button className="w-full sm:w-auto" size="lg" type="submit" disabled={submitting}>
            {submitting ? "Submitting request..." : "Request paid pilot"}
          </Button>

          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            Submitting this form requests a founder-led fit review. It does not
            create an account, start a free trial, or create a workspace.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
