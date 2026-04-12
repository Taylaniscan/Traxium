import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildAnalyticsTrackPayload,
  resetAnalyticsProviderForTests,
  trackSuccessfulLogin,
} from "@/lib/analytics";

describe("lib/analytics helpers", () => {
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPublicAnalyticsHost = process.env.NEXT_PUBLIC_ANALYTICS_HOST;
  const originalPublicAnalyticsKey = process.env.NEXT_PUBLIC_ANALYTICS_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAnalyticsProviderForTests();
    env.NODE_ENV = "test";
    env.NEXT_PUBLIC_ANALYTICS_HOST = undefined;
    env.NEXT_PUBLIC_ANALYTICS_KEY = undefined;
  });

  afterEach(() => {
    resetAnalyticsProviderForTests();
    env.NODE_ENV = originalNodeEnv;
    env.NEXT_PUBLIC_ANALYTICS_HOST = originalPublicAnalyticsHost;
    env.NEXT_PUBLIC_ANALYTICS_KEY = originalPublicAnalyticsKey;
    globalThis.fetch = originalFetch;
  });

  it("redacts raw auth header style keys from analytics payloads", () => {
    const payload = buildAnalyticsTrackPayload({
      event: "analytics.sanitization.checked",
      runtime: "server",
      organizationId: "org-1",
      userId: "user-1",
      properties: {
        "raw auth header": "opaque-secret",
        auth_header: "Bearer secret-token",
      },
    });

    expect(payload.properties).toEqual({
      "raw auth header": "[REDACTED]",
      auth_header: "[REDACTED]",
    });
  });

  it("tracks login success by emitting identify and capture payloads", async () => {
    env.NEXT_PUBLIC_ANALYTICS_HOST = "https://analytics.example.com";
    env.NEXT_PUBLIC_ANALYTICS_KEY = "public-key-123";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const results = await trackSuccessfulLogin({
      runtime: "client",
      userId: "user-1",
      organizationId: "org-1",
      appRole: "HEAD_OF_GLOBAL_PROCUREMENT",
      membershipRole: "ADMIN",
      hasInviteNextPath: true,
      destination: "invite",
    });

    expect(results).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [identifyRequest, trackRequest] = fetchMock.mock.calls;
    const identifyPayload = JSON.parse(
      String((identifyRequest?.[1] as { body?: string } | undefined)?.body ?? "")
    );
    const trackPayload = JSON.parse(
      String((trackRequest?.[1] as { body?: string } | undefined)?.body ?? "")
    );

    expect(identifyRequest?.[0]).toBe("https://analytics.example.com/identify");
    expect(identifyPayload).toMatchObject({
      type: "identify",
      runtime: "client",
      organizationId: "org-1",
      userId: "user-1",
      traits: {
        appRole: "HEAD_OF_GLOBAL_PROCUREMENT",
        membershipRole: "ADMIN",
      },
    });

    expect(trackRequest?.[0]).toBe("https://analytics.example.com/capture");
    expect(trackPayload).toMatchObject({
      type: "track",
      event: "auth.login.succeeded",
      runtime: "client",
      organizationId: "org-1",
      userId: "user-1",
      properties: {
        hasInviteNextPath: true,
        destination: "invite",
      },
    });
  });
});
