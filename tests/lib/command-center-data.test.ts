import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import { resolveCommandCenterForecastBucket } from "@/lib/data";

describe("command center data helpers", () => {
  it("normalizes invalid forecast dates into a safe fallback bucket", () => {
    expect(resolveCommandCenterForecastBucket("not-a-real-date")).toEqual({
      month: "Unknown timing",
      sortValue: Number.MAX_SAFE_INTEGER,
    });
  });

  it("builds a stable forecast bucket for valid dates", () => {
    expect(
      resolveCommandCenterForecastBucket(
        new Date("2026-04-01T00:00:00.000Z")
      )
    ).toEqual({
      month: "Apr 2026",
      sortValue: new Date(2026, 3, 1).getTime(),
    });
  });
});
