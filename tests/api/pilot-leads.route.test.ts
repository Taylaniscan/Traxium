import { beforeEach, describe, expect, it, vi } from "vitest";

const enforceRateLimitMock = vi.hoisted(() => vi.fn());
const createRateLimitErrorResponseMock = vi.hoisted(() =>
  vi.fn(() =>
    Response.json(
      {
        error: "Too many pilot requests. Please wait before trying again.",
        code: "RATE_LIMITED",
      },
      { status: 429 }
    )
  )
);
const trackServerEventMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  pilotLead: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  user: {
    create: vi.fn(),
  },
  organization: {
    create: vi.fn(),
  },
}));
const RateLimitExceededErrorMock = vi.hoisted(
  () =>
    class RateLimitExceededError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "RateLimitExceededError";
      }
    }
);

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
  createRateLimitErrorResponse: createRateLimitErrorResponseMock,
  RateLimitExceededError: RateLimitExceededErrorMock,
}));

vi.mock("@/lib/observability", () => ({
  trackServerEvent: trackServerEventMock,
  captureException: captureExceptionMock,
}));

import { POST } from "@/app/api/pilot-leads/route";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Jordan Reyes",
    workEmail: "Jordan.Reyes@Example.com",
    companyName: "  Acme   Components  ",
    jobTitle: "Procurement Director",
    companySize: "100-249",
    industry: "manufacturing",
    currentTracking: "excel",
    savingsPain: "Finance cannot trace evidence and assumptions.",
    hasSavingsTracker: true,
    timeline: "31-60_days",
    message: "We want to review a guided pilot.",
    websiteUrl: "",
    ...overrides,
  };
}

function createRequest(payload: unknown) {
  return new Request("http://localhost/api/pilot-leads", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.45",
      "user-agent": "Pilot route test",
    },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/pilot-leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PILOT_LEAD_HASH_SECRET =
      "test-pilot-lead-hash-secret-that-is-long-enough";
    enforceRateLimitMock.mockResolvedValue({
      limit: 5,
      remaining: 4,
    });
    prismaMock.pilotLead.findFirst.mockResolvedValue(null);
    prismaMock.pilotLead.create.mockResolvedValue({
      id: "lead-1",
      createdAt: new Date("2026-06-05T12:00:00.000Z"),
    });
  });

  it("stores a validated, normalized lead without creating an account or workspace", async () => {
    const response = await POST(createRequest(validPayload()));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: expect.stringContaining("guided paid pilots"),
    });
    expect(enforceRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        policy: "pilotLeadSubmission",
        action: "public.pilot-lead.submit",
      })
    );
    expect(prismaMock.pilotLead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dedupeKey: expect.stringMatching(/^[a-f0-9]{64}$/u),
        }),
      })
    );
    expect(prismaMock.pilotLead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fullName: "Jordan Reyes",
        workEmail: "jordan.reyes@example.com",
        companyName: "Acme Components",
        hasSavingsTracker: true,
        source: "public_pilot_form",
        dedupeKey: expect.stringMatching(/^[a-f0-9]{64}$/u),
        ipHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        userAgentHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
      select: {
        id: true,
        createdAt: true,
      },
    });
    expect(
      JSON.stringify(prismaMock.pilotLead.create.mock.calls[0])
    ).not.toContain("203.0.113.45");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.organization.create).not.toHaveBeenCalled();
  });

  it("returns field-level errors for missing required fields", async () => {
    const response = await POST(
      createRequest({
        fullName: "",
        workEmail: "",
        companyName: "",
        hasSavingsTracker: false,
        websiteUrl: "",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Review the highlighted fields and try again.",
      fieldErrors: {
        fullName: expect.any(String),
        workEmail: expect.any(String),
        companyName: expect.any(String),
      },
    });
    expect(prismaMock.pilotLead.create).not.toHaveBeenCalled();
  });

  it("rejects invalid work email without exposing internals", async () => {
    const response = await POST(
      createRequest(validPayload({ workEmail: "not-an-email" }))
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.workEmail).toBe("Enter a valid work email.");
    expect(JSON.stringify(body)).not.toContain("stack");
    expect(prismaMock.pilotLead.create).not.toHaveBeenCalled();
  });

  it("silently accepts a honeypot-filled request without storing a lead", async () => {
    const response = await POST(
      createRequest({
        websiteUrl: "https://spam.example",
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });
    expect(prismaMock.pilotLead.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.pilotLead.create).not.toHaveBeenCalled();
  });

  it("returns normal success for a recent duplicate without creating another row", async () => {
    prismaMock.pilotLead.findFirst.mockResolvedValueOnce({
      id: "lead-existing",
      createdAt: new Date("2026-06-05T11:00:00.000Z"),
    });

    const response = await POST(createRequest(validPayload()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });
    expect(prismaMock.pilotLead.create).not.toHaveBeenCalled();
  });

  it("returns a controlled rate-limit response", async () => {
    enforceRateLimitMock.mockRejectedValueOnce(
      new RateLimitExceededErrorMock("Too many pilot requests.")
    );

    const response = await POST(createRequest(validPayload()));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "Too many pilot requests. Please wait before trying again.",
      code: "RATE_LIMITED",
    });
    expect(prismaMock.pilotLead.create).not.toHaveBeenCalled();
  });

  it("does not expose database errors when storage fails", async () => {
    prismaMock.pilotLead.create.mockRejectedValueOnce(
      new Error("database password leaked in stack")
    );

    const response = await POST(createRequest(validPayload()));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error:
        "Your pilot request could not be submitted right now. Please try again shortly.",
    });
    expect(JSON.stringify(body)).not.toContain("database password");
    expect(JSON.stringify(body)).not.toContain("stack");
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "pilot_lead.submission_failed",
      })
    );
  });
});
