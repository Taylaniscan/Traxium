export type StructuredLogLevel = "debug" | "info" | "warn" | "error";

export type ObservabilityRuntime = "client" | "server" | "edge" | "unknown";

export type RequestLogContext = {
  requestId: string;
  route: string | null;
  method: string | null;
};

export type StructuredLogEntry = {
  timestamp: string;
  level: StructuredLogLevel;
  event: string;
  message: string | null;
  environment: string;
  runtime: ObservabilityRuntime;
  organizationId: string | null;
  userId: string | null;
  requestId: string;
  route: string | null;
  method: string | null;
  status: number | null;
  payload: Record<string, unknown>;
  error: {
    name: string;
    message: string;
    stack?: string;
  } | null;
};

export type StructuredLogInput = {
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
  error?: unknown;
};

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|token|secret|authorization|auth(?:[_ -]?header)|raw(?:[_ -]?auth[_ -]?header))/iu;
const UNSERIALIZABLE_OBJECT_PLACEHOLDER = "[UnserializableObject]";

function getAppEnvironment() {
  return process.env.APP_ENV?.trim() || process.env.NODE_ENV || "development";
}

function shouldWriteConsoleLog() {
  return getAppEnvironment() !== "test";
}

function isSensitiveKey(key: string) {
  return SENSITIVE_KEY_PATTERN.test(key);
}

function redactString(value: string) {
  return value
    .replace(/\b(Bearer)\s+[A-Za-z0-9\-._~+/]+=*/giu, "$1 [REDACTED]")
    .replace(
      /([?&](?:password|token|secret)=)([^&]+)/giu,
      "$1[REDACTED]"
    )
    .replace(
      /("(?:password|token|secret|authorization|authHeader|auth_header|auth-header|rawAuthHeader|raw_auth_header|raw-auth-header|raw auth header)"\s*:\s*")([^"]*)(")/giu,
      '$1[REDACTED]$3'
    )
    .replace(
      /(\/(?:invite|invitations)\/)([^/?]+)/giu,
      "$1[REDACTED]"
    );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function resolveObservabilityRuntime(): ObservabilityRuntime {
  if (typeof window !== "undefined") {
    return "client";
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    return "edge";
  }

  return "server";
}

export function createRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `req_${Math.random().toString(36).slice(2, 12)}`;
}

function sanitizeHeaders(headers: Headers) {
  return sanitizeForLog(Object.fromEntries(headers.entries()));
}

export function serializeErrorForLog(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactString(error.message),
      stack: error.stack ? redactString(error.stack) : undefined,
    };
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: redactString(error),
    };
  }

  return {
    name: "UnknownError",
    message: "Unexpected non-error value thrown.",
  };
}

export function sanitizeForLog(
  value: unknown,
  key?: string,
  seen = new WeakSet<object>()
): unknown {
  if (key && isSensitiveKey(key)) {
    return "[REDACTED]";
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return serializeErrorForLog(value);
  }

  if (typeof Headers !== "undefined" && value instanceof Headers) {
    return sanitizeHeaders(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, key, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    if (isPlainObject(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([entryKey, entryValue]) => [
          entryKey,
          sanitizeForLog(entryValue, entryKey, seen),
        ])
      );
    }

    try {
      return sanitizeForLog(
        JSON.parse(JSON.stringify(value)) as Record<string, unknown>,
        key,
        seen
      );
    } catch {
      return UNSERIALIZABLE_OBJECT_PLACEHOLDER;
    }
  }

  return redactString(String(value));
}

export function getRequestLogContext(request?: Request | null): RequestLogContext {
  if (!request) {
    return {
      requestId: createRequestId(),
      route: null,
      method: null,
    };
  }

  const requestId =
    request.headers.get("x-request-id")?.trim() ||
    request.headers.get("x-correlation-id")?.trim() ||
    request.headers.get("x-vercel-id")?.trim() ||
    request.headers.get("cf-ray")?.trim() ||
    request.headers.get("sentry-trace")?.trim() ||
    createRequestId();

  try {
    const url = new URL(request.url);

    return {
      requestId,
      route: redactString(url.pathname),
      method: request.method || null,
    };
  } catch {
    return {
      requestId,
      route: redactString(request.url),
      method: request.method || null,
    };
  }
}

export function writeStructuredLog(
  level: StructuredLogLevel,
  input: StructuredLogInput
) {
  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event: input.event,
    message: input.message ?? null,
    environment: getAppEnvironment(),
    runtime: input.runtime ?? resolveObservabilityRuntime(),
    organizationId: input.organizationId ?? null,
    userId: input.userId ?? null,
    requestId: input.requestId ?? createRequestId(),
    route: input.route ?? null,
    method: input.method ?? null,
    status: input.status ?? null,
    payload:
      (sanitizeForLog(input.payload ?? {}) as Record<string, unknown>) ?? {},
    error: input.error ? serializeErrorForLog(input.error) : null,
  };

  if (!shouldWriteConsoleLog()) {
    return entry;
  }

  try {
    const logLine = JSON.stringify(entry);

    switch (level) {
      case "debug":
        console.debug(logLine);
        break;
      case "info":
        console.info(logLine);
        break;
      case "warn":
        console.warn(logLine);
        break;
      default:
        console.error(logLine);
        break;
    }
  } catch {
    // Fail open. Observability must never break the main flow.
  }

  return entry;
}
