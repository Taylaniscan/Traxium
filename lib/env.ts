export type AppEnvironment =
  | "development"
  | "test"
  | "preview"
  | "production";

export type EnvRuntime = "client" | "server" | "edge" | "unknown";

type EnvSource = Record<string, string | undefined>;
type EnvRequirement = "always" | "non-test" | "production" | "never";

const DEFAULT_ANALYTICS_CAPTURE_PATH = "/capture";
const DEFAULT_ANALYTICS_IDENTIFY_PATH = "/identify";
const DEFAULT_SUPABASE_STORAGE_BUCKET = "evidence-private";

export const clientEnvKeys = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_ANALYTICS_HOST",
  "NEXT_PUBLIC_ANALYTICS_KEY",
  "NEXT_PUBLIC_ANALYTICS_CAPTURE_PATH",
  "NEXT_PUBLIC_ANALYTICS_IDENTIFY_PATH",
] as const;

export const serverEnvKeys = [
  "APP_ENV",
  "DATABASE_URL",
  "DIRECT_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PORTAL_RETURN_URL",
  "STRIPE_CHECKOUT_SUCCESS_URL",
  "STRIPE_CHECKOUT_CANCEL_URL",
  "STRIPE_STARTER_PRODUCT_ID",
  "STRIPE_STARTER_BASE_PRICE_ID",
  "STRIPE_STARTER_METERED_PRICE_ID",
  "STRIPE_GROWTH_PRODUCT_ID",
  "STRIPE_GROWTH_BASE_PRICE_ID",
  "STRIPE_GROWTH_METERED_PRICE_ID",
  "SENTRY_DSN",
  "ANALYTICS_HOST",
  "ANALYTICS_KEY",
  "ANALYTICS_CAPTURE_PATH",
  "ANALYTICS_IDENTIFY_PATH",
  "JOB_WORKER",
  "JOB_WORKER_ONCE",
  "JOB_WORKER_MAX_JOBS",
  "JOB_WORKER_IDLE_DELAY_MS",
  "JOB_WORKER_ORGANIZATION_ID",
  "JOB_WORKER_TYPES",
  "SEED_HEAD_OF_PROCUREMENT_EMAIL",
  "SEED_FINANCIAL_CONTROLLER_EMAIL",
  "SEED_TACTICAL_BUYER_EMAIL",
] as const;

const clientEnvKeySet = new Set<string>(clientEnvKeys);
const serverEnvKeySet = new Set<string>(serverEnvKeys);

function normalizeEnvValue(value: string | undefined) {
  const normalized = value?.trim() ?? "";

  if (!normalized || normalized === "undefined" || normalized === "null") {
    return "";
  }

  return normalized;
}

function normalizeAbsoluteUrl(name: string, value: string) {
  try {
    return new URL(value).toString().replace(/\/+$/u, "");
  } catch {
    throw new Error(`Malformed ${name}: ${value}`);
  }
}

function normalizePathValue(value: string, fallback: string) {
  const normalized = value.trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function parseBooleanValue(name: string, value: string) {
  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`${name} must be a boolean-like value.`);
}

function parseIntegerValue(name: string, value: string) {
  const normalized = Number.parseInt(value, 10);

  if (!Number.isFinite(normalized)) {
    throw new Error(`${name} must be an integer.`);
  }

  return normalized;
}

function getEnvironmentRequirementLabel(requirement: EnvRequirement) {
  switch (requirement) {
    case "always":
      return "all environments";
    case "production":
      return "production";
    case "non-test":
      return "development, preview, and production";
    case "never":
      return "no environment";
  }
}

function shouldRequireValue(
  environment: AppEnvironment,
  requirement: EnvRequirement
) {
  switch (requirement) {
    case "always":
      return true;
    case "production":
      return environment === "production";
    case "non-test":
      return environment !== "test";
    case "never":
      return false;
  }
}

function buildMissingEnvErrorMessage(input: {
  name: string;
  environment: AppEnvironment;
  description?: string;
  requirement: EnvRequirement;
}) {
  const description = input.description ? `${input.description} ` : "";

  return `Missing ${input.name}. ${description}Required in ${getEnvironmentRequirementLabel(
    input.requirement
  )} environments. Current environment: ${input.environment}.`;
}

function assertClientEnvName(name: string) {
  if (!clientEnvKeySet.has(name)) {
    throw new Error(`${name} is not whitelisted for client exposure.`);
  }
}

function assertServerEnvName(name: string) {
  if (!serverEnvKeySet.has(name)) {
    throw new Error(`${name} is not declared as a server environment variable.`);
  }
}

function assertServerRuntime(name: string) {
  if (typeof window !== "undefined") {
    throw new Error(`${name} is server-only and cannot be read in the browser.`);
  }
}

function readValue(input: {
  name: string;
  source?: EnvSource;
  requirement?: EnvRequirement;
  description?: string;
}) {
  const source = input.source ?? process.env;
  const environment = resolveAppEnvironment(source);
  const value = normalizeEnvValue(source[input.name]);
  const requirement = input.requirement ?? "non-test";

  if (!value) {
    if (!shouldRequireValue(environment, requirement)) {
      return "";
    }

    throw new Error(
      buildMissingEnvErrorMessage({
        name: input.name,
        environment,
        description: input.description,
        requirement,
      })
    );
  }

  return value;
}

export function resolveAppEnvironment(source: EnvSource = process.env): AppEnvironment {
  const rawValue =
    normalizeEnvValue(source.APP_ENV) ||
    normalizeEnvValue(source.NODE_ENV) ||
    "development";
  const normalizedValue = rawValue.toLowerCase();

  switch (normalizedValue) {
    case "development":
    case "dev":
    case "local":
      return "development";
    case "test":
      return "test";
    case "preview":
    case "staging":
      return "preview";
    case "production":
    case "prod":
      return "production";
    default:
      throw new Error(
        `Invalid APP_ENV "${rawValue}". Use development, test, preview, or production.`
      );
  }
}

export function isProductionEnvironment(source: EnvSource = process.env) {
  return resolveAppEnvironment(source) === "production";
}

export function isDevelopmentEnvironment(source: EnvSource = process.env) {
  return resolveAppEnvironment(source) === "development";
}

export function readClientEnv(
  name: string,
  options: {
    source?: EnvSource;
    requirement?: EnvRequirement;
    description?: string;
  } = {}
) {
  assertClientEnvName(name);

  return readValue({
    name,
    source: options.source,
    requirement: options.requirement,
    description: options.description,
  });
}

export function readOptionalClientEnv(
  name: string,
  options: {
    source?: EnvSource;
  } = {}
) {
  assertClientEnvName(name);

  return readValue({
    name,
    source: options.source,
    requirement: "never",
  }) || null;
}

export function readServerEnv(
  name: string,
  options: {
    source?: EnvSource;
    requirement?: EnvRequirement;
    description?: string;
  } = {}
) {
  assertServerRuntime(name);
  assertServerEnvName(name);

  return readValue({
    name,
    source: options.source,
    requirement: options.requirement,
    description: options.description,
  });
}

export function readOptionalServerEnv(
  name: string,
  options: {
    source?: EnvSource;
  } = {}
) {
  assertServerRuntime(name);
  assertServerEnvName(name);

  return (
    readValue({
      name,
      source: options.source,
      requirement: "never",
    }) || null
  );
}

export function readClientUrlEnv(
  name: string,
  options: {
    source?: EnvSource;
    requirement?: EnvRequirement;
    description?: string;
  } = {}
) {
  const value = readClientEnv(name, options);
  if (!value) {
    return "";
  }
  return normalizeAbsoluteUrl(name, value);
}

export function readOptionalClientUrlEnv(
  name: string,
  options: {
    source?: EnvSource;
  } = {}
) {
  const value = readOptionalClientEnv(name, options);
  return value ? normalizeAbsoluteUrl(name, value) : null;
}

export function readServerUrlEnv(
  name: string,
  options: {
    source?: EnvSource;
    requirement?: EnvRequirement;
    description?: string;
  } = {}
) {
  const value = readServerEnv(name, options);
  if (!value) {
    return "";
  }
  return normalizeAbsoluteUrl(name, value);
}

export function readOptionalServerUrlEnv(
  name: string,
  options: {
    source?: EnvSource;
  } = {}
) {
  const value = readOptionalServerEnv(name, options);
  return value ? normalizeAbsoluteUrl(name, value) : null;
}

export function readServerBooleanEnv(
  name: string,
  options: {
    source?: EnvSource;
    fallback?: boolean;
  } = {}
) {
  const value = readOptionalServerEnv(name, options);

  if (!value) {
    return options.fallback ?? false;
  }

  return parseBooleanValue(name, value);
}

export function readServerIntegerEnv(
  name: string,
  options: {
    source?: EnvSource;
    fallback: number;
    min?: number;
  }
) {
  const value = readOptionalServerEnv(name, options);

  if (!value) {
    return options.fallback;
  }

  const parsed = parseIntegerValue(name, value);

  if (options.min !== undefined && parsed < options.min) {
    throw new Error(`${name} must be greater than or equal to ${options.min}.`);
  }

  return parsed;
}

export function readServerListEnv(
  name: string,
  options: {
    source?: EnvSource;
  } = {}
) {
  const value = readOptionalServerEnv(name, options);

  if (!value) {
    return [] as string[];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getPublicAppUrl(source: EnvSource = process.env) {
  return readClientUrlEnv("NEXT_PUBLIC_APP_URL", {
    source,
    requirement: "non-test",
    description: "Public app base URL used in auth redirects.",
  });
}

export function getSupabaseProjectUrl(source: EnvSource = process.env) {
  return readClientUrlEnv("NEXT_PUBLIC_SUPABASE_URL", {
    source,
    requirement: "non-test",
    description: "Supabase project URL.",
  });
}

export function getSupabaseAnonKey(source: EnvSource = process.env) {
  return readClientEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", {
    source,
    requirement: "non-test",
    description: "Supabase anon key.",
  });
}

export function getSupabaseServiceRoleKey(source: EnvSource = process.env) {
  return readServerEnv("SUPABASE_SERVICE_ROLE_KEY", {
    source,
    requirement: "non-test",
    description: "Supabase service role key.",
  });
}

export function getDatabaseUrl(source: EnvSource = process.env) {
  return readServerEnv("DATABASE_URL", {
    source,
    requirement: "non-test",
    description: "Primary Prisma database URL.",
  });
}

export function getDirectDatabaseUrl(source: EnvSource = process.env) {
  return readServerEnv("DIRECT_URL", {
    source,
    requirement: "non-test",
    description: "Direct Prisma migration database URL.",
  });
}

export function getSupabaseStorageBucketName(
  source: EnvSource = process.env
) {
  return (
    readOptionalServerEnv("SUPABASE_STORAGE_BUCKET", {
      source,
    }) ?? DEFAULT_SUPABASE_STORAGE_BUCKET
  );
}

export function getSentryDsnForRuntime(
  runtime: EnvRuntime,
  source: EnvSource = process.env
) {
  if (runtime === "client") {
    return readOptionalClientEnv("NEXT_PUBLIC_SENTRY_DSN", {
      source,
    }) ?? "";
  }

  return (
    readOptionalServerEnv("SENTRY_DSN", {
      source,
    }) ??
    readOptionalClientEnv("NEXT_PUBLIC_SENTRY_DSN", {
      source,
    }) ??
    ""
  );
}

export function getAnalyticsRuntimeConfig(
  runtime: EnvRuntime,
  source: EnvSource = process.env
) {
  const runtimeIsClient = runtime === "client";
  const host = runtimeIsClient
    ? readOptionalClientUrlEnv("NEXT_PUBLIC_ANALYTICS_HOST", {
        source,
      })
    : readOptionalServerUrlEnv("ANALYTICS_HOST", {
        source,
      }) ??
      readOptionalClientUrlEnv("NEXT_PUBLIC_ANALYTICS_HOST", {
        source,
      });
  const key = runtimeIsClient
    ? readOptionalClientEnv("NEXT_PUBLIC_ANALYTICS_KEY", {
        source,
      })
    : readOptionalServerEnv("ANALYTICS_KEY", {
        source,
      }) ??
      readOptionalClientEnv("NEXT_PUBLIC_ANALYTICS_KEY", {
        source,
      });
  const capturePath = runtimeIsClient
    ? normalizePathValue(
        readOptionalClientEnv("NEXT_PUBLIC_ANALYTICS_CAPTURE_PATH", {
          source,
        }) ?? "",
        DEFAULT_ANALYTICS_CAPTURE_PATH
      )
    : normalizePathValue(
        readOptionalServerEnv("ANALYTICS_CAPTURE_PATH", {
          source,
        }) ??
          readOptionalClientEnv("NEXT_PUBLIC_ANALYTICS_CAPTURE_PATH", {
            source,
          }) ??
          "",
        DEFAULT_ANALYTICS_CAPTURE_PATH
      );
  const identifyPath = runtimeIsClient
    ? normalizePathValue(
        readOptionalClientEnv("NEXT_PUBLIC_ANALYTICS_IDENTIFY_PATH", {
          source,
        }) ?? "",
        DEFAULT_ANALYTICS_IDENTIFY_PATH
      )
    : normalizePathValue(
        readOptionalServerEnv("ANALYTICS_IDENTIFY_PATH", {
          source,
        }) ??
          readOptionalClientEnv("NEXT_PUBLIC_ANALYTICS_IDENTIFY_PATH", {
            source,
          }) ??
          "",
        DEFAULT_ANALYTICS_IDENTIFY_PATH
      );

  return {
    host: host ?? "",
    key: key ?? "",
    capturePath,
    identifyPath,
  };
}

export function isJobWorkerProcess(source: EnvSource = process.env) {
  return readServerBooleanEnv("JOB_WORKER", {
    source,
    fallback: false,
  });
}

export function getJobWorkerEnvironment(
  source: EnvSource = process.env,
  argv: string[] = process.argv
) {
  const stopWhenIdle =
    argv.includes("--once") ||
    readServerBooleanEnv("JOB_WORKER_ONCE", {
      source,
      fallback: false,
    });
  const maxJobs = readServerIntegerEnv("JOB_WORKER_MAX_JOBS", {
    source,
    fallback: stopWhenIdle ? 1 : 100,
    min: 1,
  });
  const idleDelayMs = readServerIntegerEnv("JOB_WORKER_IDLE_DELAY_MS", {
    source,
    fallback: 2_000,
    min: 1,
  });
  const organizationId =
    readOptionalServerEnv("JOB_WORKER_ORGANIZATION_ID", {
      source,
    }) ?? undefined;
  const types = readServerListEnv("JOB_WORKER_TYPES", {
    source,
  });

  return {
    stopWhenIdle,
    maxJobs,
    idleDelayMs,
    organizationId,
    types: types.length ? types : undefined,
  };
}

export function assertEnvironmentConfiguration(
  source: EnvSource = process.env
) {
  const appEnvironment = resolveAppEnvironment(source);
  const publicAppUrl = getPublicAppUrl(source);
  const supabaseUrl = getSupabaseProjectUrl(source);
  const supabaseAnonKey = getSupabaseAnonKey(source);
  const databaseUrl = getDatabaseUrl(source);
  const directUrl = getDirectDatabaseUrl(source);
  const serviceRoleKey = getSupabaseServiceRoleKey(source);

  return {
    appEnvironment,
    publicAppUrl,
    supabaseUrl,
    hasSupabaseAnonKey: Boolean(supabaseAnonKey),
    hasDatabaseUrl: Boolean(databaseUrl),
    hasDirectUrl: Boolean(directUrl),
    hasServiceRoleKey: Boolean(serviceRoleKey),
    hasServerSentryDsn: Boolean(getSentryDsnForRuntime("server", source)),
    hasClientSentryDsn: Boolean(getSentryDsnForRuntime("client", source)),
    hasServerAnalytics:
      Boolean(getAnalyticsRuntimeConfig("server", source).host) &&
      Boolean(getAnalyticsRuntimeConfig("server", source).key),
    hasClientAnalytics:
      Boolean(getAnalyticsRuntimeConfig("client", source).host) &&
      Boolean(getAnalyticsRuntimeConfig("client", source).key),
    storageBucket: getSupabaseStorageBucketName(source),
  };
}
