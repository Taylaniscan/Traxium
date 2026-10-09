import { beforeEach, describe, expect, it, vi } from "vitest";

const trackServerEventMock = vi.hoisted(() => vi.fn());
const enqueueJobMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  pilotLead: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/observability", () => ({
  trackServerEvent: trackServerEventMock,
}));

vi.mock("@/lib/jobs", () => ({
  enqueueJob: enqueueJobMock,
  jobTypes: { PILOT_LEAD_NOTIFICATION: "pilot_lead.notification" },
}));

import {
  buildPilotLeadNotificationEmail,
  enqueuePilotLeadNotification,
  getPilotLeadNotificationConfig,
  processPilotLeadNotificationJob,
} from "@/lib/pilot-leads/notification";

const configuredEnv = {
  RESEND_API_KEY: "re_test_key",
  PILOT_LEAD_NOTIFICATION_EMAIL: "founder@traxium.test, sales@traxium.test",
  PILOT_LEAD_NOTIFICATION_FROM: "Traxium Leads <leads@traxium.test>",
};

function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    createdAt: new Date("2026-10-09T12:08:29.585Z"),
    fullName: "Jordan Reyes",
    workEmail: "jordan@example.com",
    companyName: "Acme <Components>",
    country: "NL",
    jobTitle: "Procurement Director",
    companySize: "100-249",
    industry: "manufacturing",
    currentTracking: "excel",
    savingsPain: "Finance cannot trace evidence.",
    hasSavingsTracker: true,
    timeline: "31-60_days",
    message: null,
    ...overrides,
  };
}

const job = { id: "job-1", payload: { pilotLeadId: "lead-1" } };

describe("pilot lead notification", () => {
  beforeEach(() => {
    prismaMock.pilotLead.findUnique.mockResolvedValue(lead());
  });

  it("queues one job per lead carrying only the lead id", async () => {
    await enqueuePilotLeadNotification("lead-1");

    expect(enqueueJobMock).toHaveBeenCalledWith({
      type: "pilot_lead.notification",
      payload: { pilotLeadId: "lead-1" },
      idempotencyKey: "lead-1",
      maxAttempts: 5,
    });
  });

  it("reads recipients from a comma-separated list and requires an API key", () => {
    expect(getPilotLeadNotificationConfig(configuredEnv)).toEqual({
      apiKey: "re_test_key",
      to: ["founder@traxium.test", "sales@traxium.test"],
      from: "Traxium Leads <leads@traxium.test>",
    });
    expect(
      getPilotLeadNotificationConfig({
        PILOT_LEAD_NOTIFICATION_EMAIL: "founder@traxium.test",
      })
    ).toBeNull();
    expect(
      getPilotLeadNotificationConfig({ RESEND_API_KEY: "re_x" })
    ).toBeNull();
  });

  it("builds an email with readable labels and escaped HTML", () => {
    const email = buildPilotLeadNotificationEmail(lead());

    expect(email.subject).toBe(
      "New pilot request: Acme <Components> (Jordan Reyes)"
    );
    expect(email.text).toContain("Company size: 100-249 employees");
    expect(email.text).not.toContain("Message:");
    expect(email.html).toContain("Acme &lt;Components&gt;");
    expect(email.html).not.toContain("<Components>");
  });

  it("sends the notification through Resend with reply-to set to the lead", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));

    await processPilotLeadNotificationJob({ job }, { fetchImpl, env: configuredEnv });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer re_test_key",
      "Idempotency-Key": "pilot-lead-notification/lead-1",
    });
    expect(JSON.parse(init.body)).toMatchObject({
      from: "Traxium Leads <leads@traxium.test>",
      to: ["founder@traxium.test", "sales@traxium.test"],
      reply_to: "jordan@example.com",
    });
    expect(trackServerEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: "jobs.pilot_lead.notification.sent" })
    );
  });

  it("throws on a provider error so the job is retried", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("domain not verified", { status: 403 }));

    await expect(
      processPilotLeadNotificationJob({ job }, { fetchImpl, env: configuredEnv })
    ).rejects.toThrow("status 403: domain not verified");
  });

  it("skips without sending when notification is not configured", async () => {
    const fetchImpl = vi.fn();

    await processPilotLeadNotificationJob(
      { job },
      { fetchImpl, env: {} }
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(trackServerEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "jobs.pilot_lead.notification.skipped",
        payload: expect.objectContaining({ reason: "notification_not_configured" }),
      }),
      "warn"
    );
  });

  it("skips when the lead no longer exists", async () => {
    prismaMock.pilotLead.findUnique.mockResolvedValueOnce(null);
    const fetchImpl = vi.fn();

    await processPilotLeadNotificationJob({ job }, { fetchImpl, env: configuredEnv });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a job without a lead id", async () => {
    await expect(
      processPilotLeadNotificationJob(
        { job: { id: "job-2", payload: {} } },
        { env: configuredEnv }
      )
    ).rejects.toThrow("missing pilotLeadId");
  });
});
