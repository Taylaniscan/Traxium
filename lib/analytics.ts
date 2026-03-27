import {
  resolveObservabilityRuntime,
  sanitizeForLog,
  writeStructuredLog,
  type ObservabilityRuntime,
} from "@/lib/logger";

export const analyticsEventNames = {
  AUTH_LOGIN_SUCCEEDED: "auth.login.succeeded",
  ONBOARDING_WORKSPACE_CREATED: "onboarding.workspace_created",
  INVITATION_SENT: "invitation.sent",
  INVITATION_ACCEPTED: "invitation.accepted",
  WORKSPACE_SAMPLE_DATA_LOADED: "workspace.sample_data_loaded",
  ADMIN_MEMBER_ROLE_CHANGED: "admin.member_role_changed",
} as const;

export const analyticsInsightWindowDays = {
  recent: 7,
  extended: 30,
} as const;

export type AnalyticsEventName =
  (typeof analyticsEventNames)[keyof typeof analyticsEventNames];

export type AnalyticsInsightCutoffs = {
  now: Date;
  last7Days: Date;
  last30Days: Date;
};

type AnalyticsPrimitive = string | number | boolean | null;
type AnalyticsPropertyValue = AnalyticsPrimitive | AnalyticsPrimitive[];

export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;

export type AnalyticsTrackInput = {
  event: AnalyticsEventName | string;
  runtime?: ObservabilityRuntime;
  organizationId?: string | null;
  userId?: string | null;
  properties?: Record<string, unknown> | null;
};

export type AnalyticsIdentifyInput = {
  userId: string;
  runtime?: ObservabilityRuntime;
  organizationId?: string | null;
  traits?: Record<string, unknown> | null;
};

export type AnalyticsTrackPayload = {
  type: "track";
  event: AnalyticsEventName | string;
  runtime: ObservabilityRuntime;
  occurredAt: string;
  organizationId: string | null;
  userId: string | null;
  properties: AnalyticsProperties;
};

export type AnalyticsIdentifyPayload = {
  type: "identify";
  runtime: ObservabilityRuntime;
  identifiedAt: string;
  organizationId: string | null;
  userId: string;
  traits: AnalyticsProperties;
};

type AnalyticsHttpConfig = {
  host: string;
  key: string;
  capturePath: string;
  identifyPath: string;
  runtime: ObservabilityRuntime;
};

export interface AnalyticsProvider {
  readonly name: string;
  init?(): void | Promise<void>;
  track(payload: AnalyticsTrackPayload): void | Promise<void>;
  identify(payload: AnalyticsIdentifyPayload): void | Promise<void>;
}

const analyticsProviderCache = new Map<ObservabilityRuntime, AnalyticsProvider>();
const ANALYTICS_SENSITIVE_KEY_PATTERN =
  /(password|passwd|token|secret|authorization|auth(?:[_ -]?header)|raw(?:[_ -]?auth[_ -]?header)|email)/iu;
const ANALYTICS_EMAIL_PATTERN =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;

export type SuccessfulLoginAnalyticsInput = {
  userId: string;
  organizationId: string;
  appRole: string;
  membershipRole: string;
  hasInviteNextPath: boolean;
  destination: "invite" | "dashboard";
  runtime?: ObservabilityRuntime;
};

function trimSlashes(value: string) {
  return value.replace(/\/+$/u, "");
}

function normalizeEnvValue(value: string | undefined) {
  const normalized = value?.trim() ?? "";

  if (!normalized || normalized === "undefined" || normalized === "null") {
    return "";
  }

  return normalized;
}

function normalizePath(value: string, fallback: string) {
  const normalized = value.trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function sanitizeAnalyticsString(value: string) {
  const sanitized = sanitizeForLog(value);

  if (typeof sanitized !== "string") {
    return "[REDACTED]";
  }

  return ANALYTICS_EMAIL_PATTERN.test(sanitized) ? "[REDACTED]" : sanitized;
}

function sanitizeAnalyticsValue(
  value: unknown,
  key?: string
): AnalyticsPropertyValue | undefined {
  if (key && ANALYTICS_SENSITIVE_KEY_PATTERN.test(key)) {
    return "[REDACTED]";
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return sanitizeAnalyticsString(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    const sanitizedItems = value
      .map((item) => sanitizeAnalyticsValue(item, key))
      .filter((item): item is AnalyticsPrimitive => {
        if (Array.isArray(item) || item === undefined) {
          return false;
        }

        return true;
      });

    return sanitizedItems.length ? sanitizedItems : undefined;
  }

  if (value instanceof Error) {
    return sanitizeAnalyticsString(value.message);
  }

  if (isPlainObject(value)) {
    return undefined;
  }

  return sanitizeAnalyticsString(String(value));
}

export function normalizeAnalyticsProperties(
  properties?: Record<string, unknown> | null
): AnalyticsProperties {
  if (!properties) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(properties).flatMap(([key, value]) => {
      const sanitized = sanitizeAnalyticsValue(value, key);

      if (sanitized === undefined) {
        return [];
      }

      return [[key, sanitized]];
    })
  );
}

export function getAnalyticsInsightCutoffs(
  baseDate = new Date()
): AnalyticsInsightCutoffs {
  const now = new Date(baseDate);

  return {
    now,
    last7Days: new Date(
      now.getTime() - analyticsInsightWindowDays.recent * 24 * 60 * 60 * 1000
    ),
    last30Days: new Date(
      now.getTime() - analyticsInsightWindowDays.extended * 24 * 60 * 60 * 1000
    ),
  };
}

function getAnalyticsConfig(
  runtime: ObservabilityRuntime
): AnalyticsHttpConfig | null {
  const runtimeIsClient = runtime === "client";
  const host = runtimeIsClient
    ? normalizeEnvValue(process.env.NEXT_PUBLIC_ANALYTICS_HOST)
    : normalizeEnvValue(process.env.ANALYTICS_HOST) ||
      normalizeEnvValue(process.env.NEXT_PUBLIC_ANALYTICS_HOST);
  const key = runtimeIsClient
    ? normalizeEnvValue(process.env.NEXT_PUBLIC_ANALYTICS_KEY)
    : normalizeEnvValue(process.env.ANALYTICS_KEY) ||
      normalizeEnvValue(process.env.NEXT_PUBLIC_ANALYTICS_KEY);

  if (!host || !key) {
    return null;
  }

  const capturePath = runtimeIsClient
    ? normalizePath(
        process.env.NEXT_PUBLIC_ANALYTICS_CAPTURE_PATH ?? "",
        "/capture"
      )
    : normalizePath(
        process.env.ANALYTICS_CAPTURE_PATH ??
          process.env.NEXT_PUBLIC_ANALYTICS_CAPTURE_PATH ??
          "",
        "/capture"
      );
  const identifyPath = runtimeIsClient
    ? normalizePath(
        process.env.NEXT_PUBLIC_ANALYTICS_IDENTIFY_PATH ?? "",
        "/identify"
      )
    : normalizePath(
        process.env.ANALYTICS_IDENTIFY_PATH ??
          process.env.NEXT_PUBLIC_ANALYTICS_IDENTIFY_PATH ??
          "",
        "/identify"
      );

  return {
    host: trimSlashes(host),
    key,
    capturePath,
    identifyPath,
    runtime,
  };
}

class NoopAnalyticsProvider implements AnalyticsProvider {
  readonly name = "noop";

  async track(_payload: AnalyticsTrackPayload) {}

  async identify(_payload: AnalyticsIdentifyPayload) {}
}

class HttpAnalyticsProvider implements AnalyticsProvider {
  readonly name = "http";

  constructor(private readonly config: AnalyticsHttpConfig) {}

  private async send(path: string, payload: AnalyticsTrackPayload | AnalyticsIdentifyPayload) {
    const url = `${this.config.host}${path}`;
    const body = JSON.stringify(payload);

    if (
      this.config.runtime === "client" &&
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const sent = navigator.sendBeacon(
        url,
        new Blob([body], {
          type: "application/json",
        })
      );

      if (sent) {
        return;
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-analytics-key": this.config.key,
      },
      body,
      keepalive: this.config.runtime === "client",
    });

    if (!response.ok) {
      throw new Error(`Analytics request failed with status ${response.status}.`);
    }
  }

  async track(payload: AnalyticsTrackPayload) {
    await this.send(this.config.capturePath, payload);
  }

  async identify(payload: AnalyticsIdentifyPayload) {
    await this.send(this.config.identifyPath, payload);
  }
}

export function createAnalyticsProvider(
  runtime: ObservabilityRuntime = resolveObservabilityRuntime()
): AnalyticsProvider {
  const config = getAnalyticsConfig(runtime);

  if (!config) {
    return new NoopAnalyticsProvider();
  }

  return new HttpAnalyticsProvider(config);
}

export function initializeAnalytics(
  runtime: ObservabilityRuntime = resolveObservabilityRuntime()
) {
  const existingProvider = analyticsProviderCache.get(runtime);

  if (existingProvider) {
    return existingProvider;
  }

  const provider = createAnalyticsProvider(runtime);
  analyticsProviderCache.set(runtime, provider);

  try {
    void provider.init?.();
  } catch (error) {
    writeStructuredLog("warn", {
      event: "analytics.init.failed",
      runtime,
      message:
        error instanceof Error ? error.message : "Analytics initialization failed.",
    });
  }

  return provider;
}

export function buildAnalyticsTrackPayload(
  input: AnalyticsTrackInput
): AnalyticsTrackPayload {
  const runtime = input.runtime ?? resolveObservabilityRuntime();

  return {
    type: "track",
    event: input.event,
    runtime,
    occurredAt: new Date().toISOString(),
    organizationId: input.organizationId ?? null,
    userId: input.userId ?? null,
    properties: normalizeAnalyticsProperties(input.properties),
  };
}

export function buildAnalyticsIdentifyPayload(
  input: AnalyticsIdentifyInput
): AnalyticsIdentifyPayload {
  const runtime = input.runtime ?? resolveObservabilityRuntime();

  return {
    type: "identify",
    runtime,
    identifiedAt: new Date().toISOString(),
    organizationId: input.organizationId ?? null,
    userId: input.userId,
    traits: normalizeAnalyticsProperties(input.traits),
  };
}

export async function trackEvent(input: AnalyticsTrackInput) {
  const payload = buildAnalyticsTrackPayload(input);
  const provider = initializeAnalytics(payload.runtime);

  try {
    await provider.track(payload);
  } catch (error) {
    writeStructuredLog("warn", {
      event: "analytics.track.failed",
      runtime: payload.runtime,
      organizationId: payload.organizationId,
      userId: payload.userId,
      message: error instanceof Error ? error.message : "Analytics event failed.",
      payload: {
        analyticsEvent: payload.event,
      },
    });
  }

  return payload;
}

export async function identifyUser(input: AnalyticsIdentifyInput) {
  const payload = buildAnalyticsIdentifyPayload(input);
  const provider = initializeAnalytics(payload.runtime);

  try {
    await provider.identify(payload);
  } catch (error) {
    writeStructuredLog("warn", {
      event: "analytics.identify.failed",
      runtime: payload.runtime,
      organizationId: payload.organizationId,
      userId: payload.userId,
      message:
        error instanceof Error ? error.message : "Analytics identify failed.",
    });
  }

  return payload;
}

export async function trackSuccessfulLogin(
  input: SuccessfulLoginAnalyticsInput
) {
  const runtime = input.runtime ?? "client";

  return Promise.allSettled([
    identifyUser({
      runtime,
      userId: input.userId,
      organizationId: input.organizationId,
      traits: {
        appRole: input.appRole,
        membershipRole: input.membershipRole,
      },
    }),
    trackEvent({
      event: analyticsEventNames.AUTH_LOGIN_SUCCEEDED,
      runtime,
      userId: input.userId,
      organizationId: input.organizationId,
      properties: {
        hasInviteNextPath: input.hasInviteNextPath,
        destination: input.destination,
      },
    }),
  ]);
}

export function resetAnalyticsProviderForTests() {
  analyticsProviderCache.clear();
}
