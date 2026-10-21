import { pathToFileURL } from "node:url";

import { assertStripeBillingConfiguration } from "../lib/billing/config";
import {
  assertEnvironmentConfiguration,
  getDatabaseUrl,
  getDirectDatabaseUrl,
  getPublicAppUrl,
  getSupabaseProjectUrl,
  getSupabasePublishableKey,
  getSupabaseSecretKey,
  resolveAppEnvironment,
} from "../lib/env";
import {
  validateSupabasePublicApiKey,
  validateSupabaseSecretApiKey,
} from "../lib/supabase/api-key";

type EnvSource = Record<string, string | undefined>;
type DeployEnvironment = "preview" | "production";
type HostingEnvironment = "development" | "preview" | "production" | null;

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

// vercel.json schedules /api/jobs/run, and Vercel only runs crons for production
// deployments. Without CRON_SECRET every scheduled pass is rejected (401), so
// invitation, password-recovery, and notification emails would silently stall.
function assertVercelCronSecret(
  source: EnvSource,
  hostingEnvironment: HostingEnvironment
) {
  if (hostingEnvironment !== "production") {
    return;
  }

  if (!readOptionalValue(source, "CRON_SECRET")) {
    throw new Error(
      "CRON_SECRET is required for Vercel production deployments so the scheduled /api/jobs/run cron can authenticate."
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
  const publicKey = getSupabasePublishableKey(source);
  const secretKey = getSupabaseSecretKey(source);
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

  validateSupabasePublicApiKey({
    expectedUrl: supabaseUrl.toString(),
    key: publicKey,
  });
  validateSupabaseSecretApiKey({
    expectedUrl: supabaseUrl.toString(),
    key: secretKey,
  });

  if (publicKey === secretKey) {
    throw new Error(
      "The Supabase public and server keys must not be identical."
    );
  }

  assertPreviewProductionSeparation({
    appEnvironment,
    appHost: appUrl.hostname.toLowerCase(),
    productionAliasHost,
    hostingEnvironment,
  });
  assertVercelCronSecret(source, hostingEnvironment);

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
