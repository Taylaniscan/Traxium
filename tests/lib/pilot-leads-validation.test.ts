import { describe, expect, it } from "vitest";

import {
  pilotLeadSubmissionSchema,
  pilotLeadSuccessMessage,
} from "@/lib/pilot-leads/validation";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Jordan Reyes",
    workEmail: "JORDAN.REYES@EXAMPLE.COM",
    companyName: "Acme Components",
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

describe("pilot lead validation", () => {
  it("accepts and normalizes a valid paid-pilot request", () => {
    const result = pilotLeadSubmissionSchema.parse(validPayload());

    expect(result.workEmail).toBe("jordan.reyes@example.com");
    expect(result.companySize).toBe("100-249");
    expect(result.hasSavingsTracker).toBe(true);
    expect(pilotLeadSuccessMessage).toContain("guided paid pilots");
  });

  it("requires identity and company fields", () => {
    const result = pilotLeadSubmissionSchema.safeParse({
      fullName: "",
      workEmail: "",
      companyName: "",
      hasSavingsTracker: false,
      websiteUrl: "",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors).toMatchObject({
      fullName: expect.any(Array),
      workEmail: expect.any(Array),
      companyName: expect.any(Array),
    });
  });

  it("rejects invalid email, enum values, and overly long messages", () => {
    const result = pilotLeadSubmissionSchema.safeParse(
      validPayload({
        workEmail: "not-an-email",
        companySize: "unknown-size",
        timeline: "tomorrow",
        message: "x".repeat(1_501),
      })
    );

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors).toMatchObject({
      workEmail: expect.any(Array),
      companySize: expect.any(Array),
      timeline: expect.any(Array),
      message: expect.any(Array),
    });
  });

  it("allows optional qualification fields to remain blank", () => {
    const result = pilotLeadSubmissionSchema.parse(
      validPayload({
        jobTitle: "",
        companySize: "",
        industry: "",
        currentTracking: "",
        savingsPain: "",
        timeline: "",
        message: "",
      })
    );

    expect(result.jobTitle).toBeUndefined();
    expect(result.companySize).toBeUndefined();
    expect(result.message).toBeUndefined();
  });
});
