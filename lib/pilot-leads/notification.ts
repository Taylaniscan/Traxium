import { enqueueJob, jobTypes } from "@/lib/jobs";
import { trackServerEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import {
  pilotCompanySizeOptions,
  pilotIndustryOptions,
  pilotTimelineOptions,
  pilotTrackingOptions,
} from "@/lib/pilot-leads/validation";

const RESEND_API_URL = "https://api.resend.com/emails";
// Resend's shared test sender only delivers to the Resend account owner's
// address. Set PILOT_LEAD_NOTIFICATION_FROM to a verified domain sender in
// production.
const DEFAULT_FROM = "Traxium <onboarding@resend.dev>";

const pilotLeadNotificationSelect = {
  id: true,
  createdAt: true,
  fullName: true,
  workEmail: true,
  companyName: true,
  country: true,
  jobTitle: true,
  companySize: true,
  industry: true,
  currentTracking: true,
  savingsPain: true,
  hasSavingsTracker: true,
  timeline: true,
  message: true,
} as const;

type NotificationLead = {
  id: string;
  createdAt: Date;
  fullName: string;
  workEmail: string;
  companyName: string;
  country: string;
  jobTitle: string | null;
  companySize: string | null;
  industry: string | null;
  currentTracking: string | null;
  savingsPain: string | null;
  hasSavingsTracker: boolean | null;
  timeline: string | null;
  message: string | null;
};

type NotificationEnv = Record<string, string | undefined>;

export type PilotLeadNotificationConfig = {
  apiKey: string;
  to: string[];
  from: string;
};

export function getPilotLeadNotificationConfig(
  env: NotificationEnv = process.env
): PilotLeadNotificationConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const to = (env.PILOT_LEAD_NOTIFICATION_EMAIL ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!apiKey || to.length === 0) {
    return null;
  }

  return {
    apiKey,
    to,
    from: env.PILOT_LEAD_NOTIFICATION_FROM?.trim() || DEFAULT_FROM,
  };
}

/**
 * Queues an internal sales notification for a newly stored lead. The payload
 * carries only the lead id; the handler re-reads the row so contact details
 * never sit in the job table.
 */
export async function enqueuePilotLeadNotification(pilotLeadId: string) {
  return enqueueJob({
    type: jobTypes.PILOT_LEAD_NOTIFICATION,
    payload: { pilotLeadId },
    idempotencyKey: pilotLeadId,
    maxAttempts: 5,
  });
}

function optionLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string | null
) {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripLineBreaks(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function buildPilotLeadNotificationEmail(lead: NotificationLead) {
  const rows: Array<[string, string | null]> = [
    ["Name", lead.fullName],
    ["Work email", lead.workEmail],
    ["Company", lead.companyName],
    ["Country", lead.country],
    ["Job title", lead.jobTitle],
    ["Company size", optionLabel(pilotCompanySizeOptions, lead.companySize)],
    ["Industry", optionLabel(pilotIndustryOptions, lead.industry)],
    ["Current tracking", optionLabel(pilotTrackingOptions, lead.currentTracking)],
    [
      "Has savings tracker",
      lead.hasSavingsTracker === null ? null : lead.hasSavingsTracker ? "Yes" : "No",
    ],
    ["Pilot timeline", optionLabel(pilotTimelineOptions, lead.timeline)],
    ["Savings pain", lead.savingsPain],
    ["Message", lead.message],
    ["Submitted", lead.createdAt.toISOString()],
    ["Lead id", lead.id],
  ];
  const filled = rows.filter((row): row is [string, string] => Boolean(row[1]));

  const subject = stripLineBreaks(
    `New pilot request: ${lead.companyName} (${lead.fullName})`
  );
  const text = [
    "A new paid pilot request was submitted on the public /pilot form.",
    "",
    ...filled.map(([label, value]) => `${label}: ${value}`),
    "",
    "No account or workspace was created. Review the lead and invite them manually if there is a fit.",
  ].join("\n");
  const html = [
    "<p>A new paid pilot request was submitted on the public /pilot form.</p>",
    '<table cellpadding="6" style="border-collapse:collapse">',
    ...filled.map(
      ([label, value]) =>
        `<tr><td style="vertical-align:top;color:#555"><strong>${escapeHtml(label)}</strong></td><td style="white-space:pre-wrap">${escapeHtml(value)}</td></tr>`
    ),
    "</table>",
    "<p>No account or workspace was created. Review the lead and invite them manually if there is a fit.</p>",
  ].join("\n");

  return { subject, text, html };
}

function readPayload(payload: unknown) {
  const pilotLeadId =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>).pilotLeadId
      : undefined;

  if (typeof pilotLeadId !== "string" || !pilotLeadId.trim()) {
    throw new Error("Pilot lead notification job is missing pilotLeadId.");
  }

  return { pilotLeadId: pilotLeadId.trim() };
}

export async function processPilotLeadNotificationJob(
  {
    job,
  }: {
    job: { id: string; payload: unknown };
  },
  input: {
    fetchImpl?: typeof fetch;
    env?: NotificationEnv;
  } = {}
) {
  const { pilotLeadId } = readPayload(job.payload);
  const config = getPilotLeadNotificationConfig(input.env);

  if (!config) {
    trackServerEvent(
      {
        event: "jobs.pilot_lead.notification.skipped",
        status: 200,
        payload: {
          jobId: job.id,
          pilotLeadId,
          reason: "notification_not_configured",
        },
      },
      "warn"
    );
    return;
  }

  const lead = await prisma.pilotLead.findUnique({
    where: { id: pilotLeadId },
    select: pilotLeadNotificationSelect,
  });

  if (!lead) {
    trackServerEvent(
      {
        event: "jobs.pilot_lead.notification.skipped",
        status: 200,
        payload: { jobId: job.id, pilotLeadId, reason: "lead_not_found" },
      },
      "warn"
    );
    return;
  }

  const email = buildPilotLeadNotificationEmail(lead);
  const response = await (input.fetchImpl ?? fetch)(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `pilot-lead-notification/${lead.id}`,
    },
    body: JSON.stringify({
      from: config.from,
      to: config.to,
      reply_to: lead.workEmail,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(
      `Pilot lead notification email failed with status ${response.status}${detail ? `: ${detail}` : ""}`
    );
  }

  trackServerEvent({
    event: "jobs.pilot_lead.notification.sent",
    status: 200,
    payload: { jobId: job.id, pilotLeadId },
  });
}
