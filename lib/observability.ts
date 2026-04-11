import * as Sentry from "@sentry/nextjs";

import {
  getSentryDsnForRuntime,
  isDevelopmentEnvironment,
  isJobWorkerProcess,
  resolveAppEnvironment,
} from "@/lib/env";
import {
  getRequestLogContext,
  resolveObservabilityRuntime,
  sanitizeForLog,
  serializeErrorForLog,
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

type ObservabilityMessageJobPayload = {
  message: string;
  context: ObservabilityContext;
  level: StructuredLogLevel;
};

type ObservabilityExceptionJobPayload = {
  error: ReturnType<typeof serializeErrorForLog>;
  context: ObservabilityContext;
};

let observabilityJobsModulePromise:
  | Promise<typeof import("@/lib/jobs")>
  | null = null;

function getAppEnvironment() {
  return resolveAppEnvironment();
}

function getSentryDsn(runtime: ObservabilityRuntime) {
  return getSentryDsnForRuntime(runtime);
}

function resolveContextRuntime(context?: ObservabilityContext) {
  return context?.runtime ?? resolveObservabilityRuntime();
}

function isSentryEnabled(runtime: ObservabilityRuntime) {
  return Boolean(getSentryDsn(runtime));
}

function shouldQueueObservability(runtime: ObservabilityRuntime) {
  return runtime === "server" && !isJobWorkerProcess();
}

function loadObservabilityJobsModule() {
  observabilityJobsModulePromise ??= import("@/lib/jobs");
  return observabilityJobsModulePromise;
}

function queueObservabilityMessageJob(input: {
  message: string;
  context: ObservabilityContext;
  level: StructuredLogLevel;
  runtime: ObservabilityRuntime;
}) {
  void loadObservabilityJobsModule()
    .then(({ enqueueJob, jobTypes }) =>
      enqueueJob({
        type: jobTypes.OBSERVABILITY_MESSAGE,
        organizationId: input.context.organizationId,
        payload: {
          message: input.message,
          context: input.context,
          level: input.level,
        } satisfies ObservabilityMessageJobPayload,
      })
    )
    .catch((error) => {
      writeStructuredLog("warn", {
        event: "observability.enqueue.failed",
        runtime: input.runtime,
        organizationId: input.context.organizationId,
        userId: input.context.userId,
        message:
          error instanceof Error
            ? error.message
            : "Observability message could not be queued.",
        payload: {
          observabilityEvent: input.context.event,
          kind: "message",
        },
      });
    });
}

function queueObservabilityExceptionJob(input: {
  error: unknown;
  context: ObservabilityContext;
  runtime: ObservabilityRuntime;
}) {
  void loadObservabilityJobsModule()
    .then(({ enqueueJob, jobTypes }) =>
      enqueueJob({
        type: jobTypes.OBSERVABILITY_EXCEPTION,
        organizationId: input.context.organizationId,
        payload: {
          error: serializeErrorForLog(input.error),
          context: input.context,
        } satisfies ObservabilityExceptionJobPayload,
      })
    )
    .catch((enqueueError) => {
      writeStructuredLog("warn", {
        event: "observability.enqueue.failed",
        runtime: input.runtime,
        organizationId: input.context.organizationId,
        userId: input.context.userId,
        message:
          enqueueError instanceof Error
            ? enqueueError.message
            : "Observability exception could not be queued.",
        payload: {
          observabilityEvent: input.context.event,
          kind: "exception",
        },
      });
    });
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

function dispatchSentryMessage(
  message: string,
  context: ObservabilityContext,
  level: StructuredLogLevel
) {
  safeSentryCall(() => {
    Sentry.withScope((scope) => {
      applyScope(scope, context);
      scope.setLevel(toSentryLevel(level));
      Sentry.captureMessage(message);
    });
  });
}

function dispatchSentryException(
  error: unknown,
  context: ObservabilityContext
) {
  safeSentryCall(() => {
    Sentry.withScope((scope) => {
      applyScope(scope, context);
      Sentry.captureException(error);
    });
  });
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

  const sentryContext = {
    ...context,
    message,
    requestId: context.requestId ?? entry.requestId,
    runtime,
  };

  if (shouldQueueObservability(runtime)) {
    queueObservabilityMessageJob({
      message,
      context: sentryContext,
      level,
      runtime,
    });
    return entry;
  }

  dispatchSentryMessage(message, sentryContext, level);

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

  const sentryContext = {
    ...context,
    requestId: context.requestId ?? entry.requestId,
    runtime,
  };

  if (shouldQueueObservability(runtime)) {
    queueObservabilityExceptionJob({
      error,
      context: sentryContext,
      runtime,
    });
    return entry;
  }

  dispatchSentryException(error, sentryContext);

  return entry;
}

function buildErrorFromJobPayload(
  payload: ReturnType<typeof serializeErrorForLog>
) {
  const error = new Error(payload.message);
  error.name = payload.name;

  if (payload.stack) {
    error.stack = payload.stack;
  }

  return error;
}

export async function processObservabilityMessageJob({
  job,
}: {
  job: {
    payload: unknown;
  };
}) {
  const payload = job.payload as ObservabilityMessageJobPayload;
  dispatchSentryMessage(payload.message, payload.context, payload.level);
}

export async function processObservabilityExceptionJob({
  job,
}: {
  job: {
    payload: unknown;
  };
}) {
  const payload = job.payload as ObservabilityExceptionJobPayload;
  dispatchSentryException(
    buildErrorFromJobPayload(payload.error),
    payload.context
  );
}

export function buildSentryInitOptions(runtime: ObservabilityRuntime) {
  const dsn = getSentryDsn(runtime);
  const tracesSampleRate = isDevelopmentEnvironment() ? 1 : 0.2;

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
