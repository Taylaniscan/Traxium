import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockSentryScope = {
  setTag: ReturnType<typeof vi.fn>;
  setUser: ReturnType<typeof vi.fn>;
  setContext: ReturnType<typeof vi.fn>;
  setFingerprint: ReturnType<typeof vi.fn>;
  setLevel: ReturnType<typeof vi.fn>;
};

const sentryState = vi.hoisted(() => {
  const scope: MockSentryScope = {
    setTag: vi.fn(),
    setUser: vi.fn(),
    setContext: vi.fn(),
    setFingerprint: vi.fn(),
    setLevel: vi.fn(),
  };

  return {
    addBreadcrumb: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    withScope: vi.fn((callback: (scope: MockSentryScope) => void) => callback(scope)),
    scope,
  };
});

vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: sentryState.addBreadcrumb,
  captureException: sentryState.captureException,
  captureMessage: sentryState.captureMessage,
  withScope: sentryState.withScope,
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    fmt: vi.fn(),
  },
  captureRequestError: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));

import { sanitizeForLog } from "@/lib/logger";
import {
  buildSentryInitOptions,
  captureException,
  getObservabilityRequestContext,
  trackServerEvent,
} from "@/lib/observability";

describe("lib/observability", () => {
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppEnv = process.env.APP_ENV;
  const originalSentryDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    vi.clearAllMocks();
    env.NODE_ENV = "test";
    env.APP_ENV = "test";
    env.SENTRY_DSN = "https://public@example.ingest.sentry.io/1";
  });

  afterEach(() => {
    env.NODE_ENV = originalNodeEnv;
    env.APP_ENV = originalAppEnv;
    env.SENTRY_DSN = originalSentryDsn;
  });

  it("masks sensitive fields before logging or sending events", () => {
    const sanitized = sanitizeForLog({
      password: "super-secret-password",
      token: "invite-token-123",
      nested: {
        secret: "top-secret",
        authorization: "Bearer abc.def.ghi",
      },
      url: "http://localhost:3000/api/invitations/token-123/accept?token=invite-token-123",
      note: '{"password":"super-secret-password","token":"invite-token-123"}',
    });

    expect(sanitized).toEqual({
      password: "[REDACTED]",
      token: "[REDACTED]",
      nested: {
        secret: "[REDACTED]",
        authorization: "[REDACTED]",
      },
      url: "http://localhost:3000/api/invitations/[REDACTED]/accept?token=[REDACTED]",
      note: '{"password":"[REDACTED]","token":"[REDACTED]"}',
    });
  });

  it("keeps structured event payloads consistent with request and actor metadata", () => {
    const request = new Request("http://localhost/api/admin/settings?token=abc", {
      method: "PATCH",
      headers: {
        "x-request-id": "req-123",
      },
    });
    const requestContext = getObservabilityRequestContext(request);

    const entry = trackServerEvent({
      event: "admin.settings.update.succeeded",
      organizationId: "org-1",
      userId: "user-1",
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: requestContext.method,
      status: 200,
      payload: {
        changed: true,
        token: "should-not-appear",
      },
    });

    expect(entry).toMatchObject({
      level: "info",
      event: "admin.settings.update.succeeded",
      organizationId: "org-1",
      userId: "user-1",
      requestId: "req-123",
      route: "/api/admin/settings",
      method: "PATCH",
      status: 200,
      payload: {
        changed: true,
        token: "[REDACTED]",
      },
    });
    expect(sentryState.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "admin.settings.update.succeeded",
        data: expect.objectContaining({
          organizationId: "org-1",
          userId: "user-1",
          requestId: "req-123",
        }),
      })
    );
  });

  it("fails open when the underlying observability transport throws", () => {
    sentryState.captureException.mockImplementationOnce(() => {
      throw new Error("Sentry transport failed.");
    });

    expect(() =>
      captureException(new Error("Database connection dropped."), {
        event: "api.database.failed",
        organizationId: "org-1",
        userId: "user-1",
        requestId: "req-456",
        status: 500,
      })
    ).not.toThrow();
  });

  it("sanitizes Sentry event payloads through the shared init config", () => {
    const options = buildSentryInitOptions("server");
    const beforeSend = options.beforeSend;

    expect(beforeSend).toBeTypeOf("function");

    const sanitizedEvent = beforeSend?.(
      {
        request: {
          headers: {
            authorization: "Bearer top-secret-header",
          },
          url: "http://localhost/api/invitations/token-123/complete?token=invite-token-123",
        },
        extra: {
          secret: "very-secret",
        },
      } as never,
      {} as never
    );

    expect(sanitizedEvent).toEqual({
      request: {
        headers: {
          authorization: "[REDACTED]",
        },
        url: "http://localhost/api/invitations/[REDACTED]/complete?token=[REDACTED]",
      },
      extra: {
        secret: "[REDACTED]",
      },
    });
  });
});
