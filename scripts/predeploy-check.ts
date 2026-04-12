import { pathToFileURL } from "node:url";

import { assertStripeBillingConfiguration } from "../lib/billing/config";
import {
  assertEnvironmentConfiguration,
  getDatabaseUrl,
  getDirectDatabaseUrl,
  getPublicAppUrl,
  getSupabaseAnonKey,
  getSupabaseProjectUrl,
  getSupabaseServiceRoleKey,
  resolveAppEnvironment,
} from "../lib/env";

type EnvSource = Record<string, string | undefined>;
type DeployEnvironment = "preview" | "production";
type HostingEnvironment = "development" | "preview" | "production" | null;
type JwtClaims = {
  role?: string;
  ref?: string;
};

export type PredeployCheckResult = {
  appEnvironment: DeployEnvironment;
  hostingEnvironment: HostingEnvironment;
  appHost: string;
  supabaseProjectRef: string;
  databaseHost: string;
  directHost: string;
  productionAliasHost: string | null;
  stripeKeyMode: "live" | "test";
};

function normalizeValue(value?: string) {
  return value?.trim() ?? "";
}

function readOptionalValue(source: EnvSource, name: string) {
  return normalizeValue(source[name]) || null;
}

function ensureDeployEnvironment(source: EnvSource): DeployEnvironment {
  const appEnvironment = resolveAppEnvironment(source);

  if (appEnvironment === "preview" || appEnvironment === "production") {
    return appEnvironment;
  }

  throw new Error(
    `predeploy-check can only run for preview or production deployments. Current APP_ENV: ${appEnvironment}.`
  );
}

function parseAbsoluteUrl(name: string, value: string) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
}

function parsePostgresUrl(name: string, value: string) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL connection string.`);
  }
}

function parseHostFromDomainLikeValue(name: string, value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const normalized = /^[a-z]+:\/\//iu.test(value) ? value : `https://${value}`;
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    throw new Error(`${name} must be a valid hostname or absolute URL.`);
  }
}

function isLocalHost(hostname: string) {
  const normalized = hostname.toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}

function assertNonLocalHost(name: string, hostname: string) {
  if (isLocalHost(hostname)) {
    throw new Error(`${name} must not point to a local host for deployed environments.`);
  }
}

function assertNotPlaceholderAppUrl(hostname: string) {
  if (
    hostname === "example.com" ||
    hostname === "www.example.com" ||
    hostname.endsWith(".example.com")
  ) {
    throw new Error("NEXT_PUBLIC_APP_URL still points at an example domain.");
  }
}

function assertNotPlaceholderSupabaseUrl(hostname: string) {
  if (hostname === "example.supabase.co") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL still points at the example Supabase project.");
  }
}

function assertNotPlaceholderDatabaseUrl(name: string, url: URL) {
  if (url.username === "postgres.example") {
    throw new Error(`${name} still uses the example Supabase project reference.`);
  }
}

function getSupabaseProjectRefFromUrl(url: URL) {
  const [projectRef = ""] = url.hostname.split(".");

  if (!projectRef) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must include a Supabase project host.");
  }

  return projectRef;
}

function normalizeHostingEnvironment(source: EnvSource): HostingEnvironment {
  const rawValue = readOptionalValue(source, "VERCEL_ENV");

  if (!rawValue) {
    return null;
  }

  switch (rawValue.toLowerCase()) {
    case "development":
      return "development";
    case "preview":
      return "preview";
    case "production":
      return "production";
    default:
      throw new Error(
        `VERCEL_ENV must be development, preview, or production. Received: ${rawValue}.`
      );
  }
}

function decodeJwtClaims(name: string, token: string): JwtClaims {
  const [, payload = ""] = token.split(".");

  if (!payload) {
    throw new Error(`${name} must be a JWT-like value.`);
  }

  try {
    const normalizedPayload = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");

    return JSON.parse(
      Buffer.from(normalizedPayload, "base64").toString("utf8")
    ) as JwtClaims;
  } catch {
    throw new Error(`${name} must be a valid JWT-like value.`);
  }
}

function assertSupabaseJwt(input: {
  name: string;
  token: string;
  expectedRole: "anon" | "service_role";
  expectedProjectRef: string;
}) {
  const claims = decodeJwtClaims(input.name, input.token);

  if (claims.role !== input.expectedRole) {
    throw new Error(
      `${input.name} must carry the ${input.expectedRole} role claim.`
    );
  }

  if (claims.ref !== input.expectedProjectRef) {
    throw new Error(
      `${input.name} project ref mismatch. Expected ${input.expectedProjectRef}, received ${claims.ref ?? "unknown"}.`
    );
  }
}

function assertPreviewProductionSeparation(input: {
  appEnvironment: DeployEnvironment;
  appHost: string;
  productionAliasHost: string | null;
  hostingEnvironment: HostingEnvironment;
}) {
  if (
    input.hostingEnvironment &&
    input.hostingEnvironment !== input.appEnvironment
  ) {
    throw new Error(
      `APP_ENV (${input.appEnvironment}) must match VERCEL_ENV (${input.hostingEnvironment}) during deploys.`
    );
  }

  if (
    input.appEnvironment === "preview" &&
    input.productionAliasHost &&
    input.appHost === input.productionAliasHost
  ) {
    throw new Error(
      "Preview deployments must not use the production application domain."
    );
  }

  if (
    input.appEnvironment === "production" &&
    input.productionAliasHost &&
    input.appHost !== input.productionAliasHost
  ) {
    throw new Error(
      "Production deployments must use the configured production application domain."
    );
  }
}

export function assertPredeployConfiguration(
  source: EnvSource = process.env
): PredeployCheckResult {
  const appEnvironment = ensureDeployEnvironment(source);
  assertEnvironmentConfiguration(source);
  const billing = assertStripeBillingConfiguration(source);
  const appUrl = parseAbsoluteUrl(
    "NEXT_PUBLIC_APP_URL",
    getPublicAppUrl(source)
  );
  const supabaseUrl = parseAbsoluteUrl(
    "NEXT_PUBLIC_SUPABASE_URL",
    getSupabaseProjectUrl(source)
  );
  const databaseUrl = parsePostgresUrl("DATABASE_URL", getDatabaseUrl(source));
  const directUrl = parsePostgresUrl("DIRECT_URL", getDirectDatabaseUrl(source));
  const anonKey = getSupabaseAnonKey(source);
  const serviceRoleKey = getSupabaseServiceRoleKey(source);
  const hostingEnvironment = normalizeHostingEnvironment(source);
  const productionAliasHost = parseHostFromDomainLikeValue(
    "VERCEL_PROJECT_PRODUCTION_URL",
    readOptionalValue(source, "VERCEL_PROJECT_PRODUCTION_URL")
  );

  assertNonLocalHost("NEXT_PUBLIC_APP_URL", appUrl.hostname);
  assertNonLocalHost("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl.hostname);
  assertNonLocalHost("DATABASE_URL", databaseUrl.hostname);
  assertNonLocalHost("DIRECT_URL", directUrl.hostname);
  assertNotPlaceholderAppUrl(appUrl.hostname.toLowerCase());
  assertNotPlaceholderSupabaseUrl(supabaseUrl.hostname.toLowerCase());
  assertNotPlaceholderDatabaseUrl("DATABASE_URL", databaseUrl);
  assertNotPlaceholderDatabaseUrl("DIRECT_URL", directUrl);

  const supabaseProjectRef = getSupabaseProjectRefFromUrl(supabaseUrl);

  assertSupabaseJwt({
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    token: anonKey,
    expectedRole: "anon",
    expectedProjectRef: supabaseProjectRef,
  });
  assertSupabaseJwt({
    name: "SUPABASE_SERVICE_ROLE_KEY",
    token: serviceRoleKey,
    expectedRole: "service_role",
    expectedProjectRef: supabaseProjectRef,
  });

  if (anonKey === serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must not be identical."
    );
  }

  assertPreviewProductionSeparation({
    appEnvironment,
    appHost: appUrl.hostname.toLowerCase(),
    productionAliasHost,
    hostingEnvironment,
  });

  return {
    appEnvironment,
    hostingEnvironment,
    appHost: appUrl.hostname.toLowerCase(),
    supabaseProjectRef,
    databaseHost: databaseUrl.hostname.toLowerCase(),
    directHost: directUrl.hostname.toLowerCase(),
    productionAliasHost,
    stripeKeyMode: billing.secretKeyMode,
  };
}

function runCliCheck() {
  try {
    const result = assertPredeployConfiguration();

    console.info(
      JSON.stringify({
        event: "predeploy.check.passed",
        ...result,
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "predeploy.check.failed",
        error:
          error instanceof Error
            ? error.message
            : "Predeploy validation failed.",
      })
    );
    process.exitCode = 1;
  }
}

const isCliExecution =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCliExecution) {
  runCliCheck();
}
