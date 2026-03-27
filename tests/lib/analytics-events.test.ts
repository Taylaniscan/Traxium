import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enqueueJobMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/jobs", () => ({
  enqueueJob: enqueueJobMock,
  jobTypes: {
    INVITATION_EMAIL_DELIVERY: "auth_email.invitation_delivery",
    PASSWORD_RECOVERY_EMAIL_DELIVERY: "auth_email.password_recovery_delivery",
    ANALYTICS_TRACK: "analytics.track",
    ANALYTICS_IDENTIFY: "analytics.identify",
    OBSERVABILITY_MESSAGE: "observability.message",
    OBSERVABILITY_EXCEPTION: "observability.exception",
  },
}));

import {
  analyticsEventNames,
  buildAnalyticsIdentifyPayload,
  buildAnalyticsTrackPayload,
  resetAnalyticsProviderForTests,
  trackEvent,
} from "@/lib/analytics";

describe("lib/analytics", () => {
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAnalyticsHost = process.env.ANALYTICS_HOST;
  const originalAnalyticsKey = process.env.ANALYTICS_KEY;
  const originalPublicAnalyticsHost = process.env.NEXT_PUBLIC_ANALYTICS_HOST;
  const originalPublicAnalyticsKey = process.env.NEXT_PUBLIC_ANALYTICS_KEY;
  const originalJobWorker = process.env.JOB_WORKER;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAnalyticsProviderForTests();
    env.NODE_ENV = "test";
    env.ANALYTICS_HOST = undefined;
    env.ANALYTICS_KEY = undefined;
    env.NEXT_PUBLIC_ANALYTICS_HOST = undefined;
    env.NEXT_PUBLIC_ANALYTICS_KEY = undefined;
    delete env.JOB_WORKER;
  });

  afterEach(() => {
    resetAnalyticsProviderForTests();
    env.NODE_ENV = originalNodeEnv;
    env.ANALYTICS_HOST = originalAnalyticsHost;
    env.ANALYTICS_KEY = originalAnalyticsKey;
    env.NEXT_PUBLIC_ANALYTICS_HOST = originalPublicAnalyticsHost;
    env.NEXT_PUBLIC_ANALYTICS_KEY = originalPublicAnalyticsKey;
    env.JOB_WORKER = originalJobWorker;
    globalThis.fetch = originalFetch;
  });

  it("builds sanitized analytics track payloads with minimal metadata", () => {
    const payload = buildAnalyticsTrackPayload({
      event: analyticsEventNames.INVITATION_SENT,
      runtime: "server",
      organizationId: "org-1",
      userId: "user-1",
      properties: {
        invitationId: "invite-1",
        invitationRole: "MEMBER",
        email: "person@example.com",
        token: "secret-token",
        note: "sent for user@example.com",
        nested: {
          shouldDrop: true,
        },
      },
    });

    expect(payload).toMatchObject({
      type: "track",
      event: "invitation.sent",
      runtime: "server",
      organizationId: "org-1",
      userId: "user-1",
      properties: {
        invitationId: "invite-1",
        invitationRole: "MEMBER",
        email: "[REDACTED]",
        token: "[REDACTED]",
        note: "[REDACTED]",
      },
    });
    expect(payload.occurredAt).toBeTypeOf("string");
    expect(payload.properties).not.toHaveProperty("nested");
  });

  it("builds identify payloads without personal data leakage", () => {
    const payload = buildAnalyticsIdentifyPayload({
      runtime: "client",
      userId: "user-1",
      organizationId: "org-1",
      traits: {
        appRole: "HEAD_OF_GLOBAL_PROCUREMENT",
        membershipRole: "ADMIN",
        email: "user@example.com",
      },
    });

    expect(payload).toMatchObject({
      type: "identify",
      runtime: "client",
      userId: "user-1",
      organizationId: "org-1",
      traits: {
        appRole: "HEAD_OF_GLOBAL_PROCUREMENT",
        membershipRole: "ADMIN",
        email: "[REDACTED]",
      },
    });
    expect(payload.identifiedAt).toBeTypeOf("string");
  });

  it("queues server-side analytics events instead of sending them inline", async () => {
    await expect(
      trackEvent({
        event: analyticsEventNames.AUTH_LOGIN_SUCCEEDED,
        runtime: "server",
        organizationId: "org-1",
        userId: "user-1",
        properties: {
          destination: "dashboard",
        },
        idempotencyKey: "login-success:user-1",
      })
    ).resolves.toMatchObject({
      event: "auth.login.succeeded",
      organizationId: "org-1",
      userId: "user-1",
    });

    expect(enqueueJobMock).toHaveBeenCalledWith({
      type: "analytics.track",
      organizationId: "org-1",
      payload: expect.objectContaining({
        type: "track",
        event: "auth.login.succeeded",
        runtime: "server",
        organizationId: "org-1",
        userId: "user-1",
      }),
      idempotencyKey: "login-success:user-1",
    });
  });

  it("fails open when the configured client analytics transport throws", async () => {
    env.NEXT_PUBLIC_ANALYTICS_HOST = "https://analytics.example.com";
    env.NEXT_PUBLIC_ANALYTICS_KEY = "key-123";
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(
      trackEvent({
        event: analyticsEventNames.WORKSPACE_SAMPLE_DATA_LOADED,
        runtime: "client",
        organizationId: "org-1",
        userId: "user-1",
        properties: {
          createdCardsCount: 3,
        },
      })
    ).resolves.toMatchObject({
      event: "workspace.sample_data_loaded",
      properties: {
        createdCardsCount: 3,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://analytics.example.com/capture",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-analytics-key": "key-123",
        },
      })
    );
    expect(enqueueJobMock).not.toHaveBeenCalled();
  });

  it("exposes the documented activation and admin analytics event names", () => {
    expect(Object.values(analyticsEventNames)).toEqual([
      "auth.login.succeeded",
      "onboarding.workspace_created",
      "invitation.sent",
      "invitation.accepted",
      "workspace.sample_data_loaded",
      "admin.member_role_changed",
    ]);
  });
});
