import { describe, expect, it } from "vitest";

import { sanitizeForLog, writeStructuredLog } from "@/lib/logger";

describe("lib/logger", () => {
  it("masks raw auth header variants and JSON fragments", () => {
    const sanitized = sanitizeForLog({
      "raw auth header": "opaque-secret",
      nested: {
        "auth header": "Bearer top-secret-token",
      },
      note:
        '{"raw auth header":"opaque-secret","raw_auth_header":"opaque-secret"}',
    });

    expect(sanitized).toEqual({
      "raw auth header": "[REDACTED]",
      nested: {
        "auth header": "[REDACTED]",
      },
      note:
        '{"raw auth header":"[REDACTED]","raw_auth_header":"[REDACTED]"}',
    });
  });

  it("converts bigint payload values into JSON-safe strings", () => {
    const entry = writeStructuredLog("info", {
      event: "logger.bigint.payload",
      payload: {
        totalMembers: BigInt(7),
      },
    });

    expect(entry.payload).toEqual({
      totalMembers: "7",
    });
    expect(() => JSON.stringify(entry)).not.toThrow();
  });

  it("fails open for unserializable custom objects", () => {
    class CircularAnalyticsCarrier {
      self: CircularAnalyticsCarrier;

      constructor() {
        this.self = this;
      }
    }

    expect(() => sanitizeForLog(new CircularAnalyticsCarrier())).not.toThrow();
    expect(sanitizeForLog(new CircularAnalyticsCarrier())).toBe(
      "[UnserializableObject]"
    );
  });
});
