import * as Sentry from "@sentry/nextjs";

import {
  getRequestLogContext,
  resolveObservabilityRuntime,
  sanitizeForLog,
  writeStructuredLog,
  type ObservabilityRuntime,
  type RequestLogContext,
  type StructuredLogEntry,
  type StructuredLogLevel,
} from "@/lib/logger";

export type ObservabilityContext = {
  event: string;
  message?: string | null;
  runtime?: ObservabilityRuntime;
  organizationId?: string | null;
  userId?: string | null;
  requestId?: string | null;
  route?: string | null;
  method?: string | null;
  status?: number | null;
  payload?: Record<string, unknown> | null;
  tags?: Record<string, string | number | boolean | null | undefined>;
  fingerprint?: string[];
};

function getAppEnvironment() {
  return process.env.APP_ENV?.trim() || process.env.NODE_ENV || "development";
}

function getSentryDsn(runtime: ObservabilityRuntime) {
  if (runtime === "client") {
    return process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || "";
  }

  return (
    process.env.SENTRY_DSN?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
    ""
  );
}

function resolveContextRuntime(context?: ObservabilityContext) {
  return context?.runtime ?? resolveObservabilityRuntime();
}

function isSentryEnabled(runtime: ObservabilityRuntime) {
  return Boolean(getSentryDsn(runtime));
}

function toSentryLevel(level: StructuredLogLevel) {
  switch (level) {
    case "warn":
      return "warning";
    case "debug":
      return "debug";
    default:
      return level;
  }
}

function applyScope(scope: Sentry.Scope, context: ObservabilityContext) {
  scope.setTag("event", context.event);

  if (context.organizationId) {
    scope.setTag("organizationId", context.organizationId);
  }

  if (context.requestId) {
    scope.setTag("requestId", context.requestId);
  }

  if (context.route) {
    scope.setTag("route", context.route);
  }

  if (context.method) {
    scope.setTag("method", context.method);
  }

  if (context.status) {
    scope.setTag("status", String(context.status));
  }

  if (context.userId) {
    scope.setUser({ id: context.userId });
  }

  for (const [tagKey, tagValue] of Object.entries(context.tags ?? {})) {
    if (tagValue !== undefined && tagValue !== null) {
      scope.setTag(tagKey, String(tagValue));
    }
  }

  const payload = sanitizeForLog(context.payload ?? {});

  if (payload && typeof payload === "object") {
    scope.setContext("observability", payload as Record<string, unknown>);
  }

  if (context.fingerprint?.length) {
    scope.setFingerprint(context.fingerprint);
  }
}

function safeSentryCall(callback: () => void) {
  try {
    callback();
  } catch {
    // Fail open. Sentry must never break the main flow.
  }
}

function addBreadcrumb(level: StructuredLogLevel, context: ObservabilityContext) {
  const runtime = resolveContextRuntime(context);

  if (!isSentryEnabled(runtime)) {
    return;
  }

  safeSentryCall(() => {
    Sentry.addBreadcrumb({
      category: context.event,
      type: "default",
      level: toSentryLevel(level),
      message: context.message ?? context.event,
      data: sanitizeForLog({
        organizationId: context.organizationId ?? null,
        userId: context.userId ?? null,
        requestId: context.requestId ?? null,
        route: context.route ?? null,
        method: context.method ?? null,
        status: context.status ?? null,
        payload: context.payload ?? {},
      }) as Record<string, unknown>,
    });
  });
}

export function getObservabilityRequestContext(request?: Request | null) {
  return getRequestLogContext(request);
}

export function mergeObservabilityContext(
  request: Request | null | undefined,
  context: Omit<ObservabilityContext, "requestId" | "route" | "method">
) {
  const requestContext = getRequestLogContext(request);

  return {
    ...context,
    requestId: requestContext.requestId,
    route: requestContext.route,
    method: requestContext.method,
  } satisfies ObservabilityContext;
}

export function trackServerEvent(
  context: ObservabilityContext,
  level: StructuredLogLevel = "info"
): StructuredLogEntry {
  const entry = writeStructuredLog(level, context);

  addBreadcrumb(level, {
    ...context,
    requestId: context.requestId ?? entry.requestId,
  });

  return entry;
}

export function trackClientEvent(
  context: ObservabilityContext,
  level: StructuredLogLevel = "info"
) {
  return trackServerEvent(
    {
      ...context,
      runtime: "client",
    },
    level
  );
}

export function captureMessage(
  message: string,
  context: Omit<ObservabilityContext, "message">,
  level: StructuredLogLevel = "info"
): StructuredLogEntry {
  const runtime = resolveContextRuntime(context);
  const entry = writeStructuredLog(level, {
    ...context,
    message,
    runtime,
  });

  addBreadcrumb(level, {
    ...context,
    message,
    requestId: context.requestId ?? entry.requestId,
    runtime,
  });

  if (!isSentryEnabled(runtime)) {
    return entry;
  }

  safeSentryCall(() => {
    Sentry.withScope((scope) => {
      applyScope(scope, {
        ...context,
        message,
        requestId: context.requestId ?? entry.requestId,
        runtime,
      });
      scope.setLevel(toSentryLevel(level));
      Sentry.captureMessage(message);
    });
  });

  return entry;
}

export function captureException(
  error: unknown,
  context: ObservabilityContext
): StructuredLogEntry {
  const runtime = resolveContextRuntime(context);
  const entry = writeStructuredLog("error", {
    ...context,
    runtime,
    error,
  });

  addBreadcrumb("error", {
    ...context,
    requestId: context.requestId ?? entry.requestId,
    runtime,
  });

  if (!isSentryEnabled(runtime)) {
    return entry;
  }

  safeSentryCall(() => {
    Sentry.withScope((scope) => {
      applyScope(scope, {
        ...context,
        requestId: context.requestId ?? entry.requestId,
        runtime,
      });
      Sentry.captureException(error);
    });
  });

  return entry;
}

export function buildSentryInitOptions(runtime: ObservabilityRuntime) {
  const dsn = getSentryDsn(runtime);
  const tracesSampleRate =
    process.env.NODE_ENV === "development" ? 1 : 0.2;

  const options: Sentry.BrowserOptions | Sentry.NodeOptions | Sentry.EdgeOptions = {
    dsn,
    enabled: Boolean(dsn),
    environment: getAppEnvironment(),
    sendDefaultPii: false,
    enableLogs: true,
    tracesSampleRate,
    beforeSend(event) {
      return sanitizeForLog(event) as typeof event;
    },
  };

  return options;
}

export function createRouteObservabilityContext(
  request: Request | null | undefined,
  context: Omit<ObservabilityContext, "requestId" | "route" | "method">
): ObservabilityContext & RequestLogContext {
  const requestContext = getObservabilityRequestContext(request);

  return {
    ...context,
    requestId: requestContext.requestId,
    route: requestContext.route,
    method: requestContext.method,
  };
}
