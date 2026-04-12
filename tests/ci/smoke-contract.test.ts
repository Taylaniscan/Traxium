import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertEnvironmentConfiguration,
  getJobWorkerEnvironment,
  readClientEnv,
  resolveAppEnvironment,
} from "@/lib/env";
import { buildAppUrl } from "@/lib/app-url";
import { sanitizeForLog } from "@/lib/logger";

const ORIGINAL_ENV = { ...process.env };

function setCiLikeEnvironment(overrides: Record<string, string | undefined> = {}) {
  process.env.APP_ENV = "preview";
  process.env.NEXT_PUBLIC_APP_URL = "https://preview-ci.traxium.test";
  process.env.DATABASE_URL =
    "postgresql://postgres.previewci:preview-ci-password@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30";
  process.env.DIRECT_URL =
    "postgresql://postgres.previewci:preview-ci-password@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://previewci.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InByZXZpZXdjaSJ9.sig";
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwicmVmIjoicHJldmlld2NpIn0.sig";
  process.env.JOB_WORKER_ONCE = "true";
  process.env.JOB_WORKER_MAX_JOBS = "7";
  process.env.JOB_WORKER_IDLE_DELAY_MS = "1500";
  process.env.JOB_WORKER_TYPES = "analytics.track, observability.message";

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

describe("CI smoke contract", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    setCiLikeEnvironment();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("accepts the preview-grade CI environment contract", () => {
    expect(resolveAppEnvironment()).toBe("preview");
    expect(assertEnvironmentConfiguration()).toEqual({
      appEnvironment: "preview",
      publicAppUrl: "https://preview-ci.traxium.test",
      supabaseUrl: "https://previewci.supabase.co",
      hasSupabaseAnonKey: true,
      hasDatabaseUrl: true,
      hasDirectUrl: true,
      hasServiceRoleKey: true,
      hasServerSentryDsn: false,
      hasClientSentryDsn: false,
      hasServerAnalytics: false,
      hasClientAnalytics: false,
      storageBucket: "evidence-private",
    });
  });

  it("keeps client env access on the public whitelist only", () => {
    expect(readClientEnv("NEXT_PUBLIC_SUPABASE_URL")).toBe(
      "https://previewci.supabase.co"
    );
    expect(() => readClientEnv("SUPABASE_SERVICE_ROLE_KEY")).toThrow(
      "SUPABASE_SERVICE_ROLE_KEY is not whitelisted for client exposure."
    );
  });

  it("parses worker settings and preserves deterministic app URLs", () => {
    expect(getJobWorkerEnvironment()).toEqual({
      stopWhenIdle: true,
      maxJobs: 7,
      idleDelayMs: 1500,
      organizationId: undefined,
      types: ["analytics.track", "observability.message"],
    });
    expect(buildAppUrl("/login")).toBe("https://preview-ci.traxium.test/login");
  });

  it("redacts secrets in structured log payloads", () => {
    expect(
      sanitizeForLog({
        token: "super-secret-token",
        nested: {
          password: "unsafe-password",
        },
        url: "https://example.com/reset?token=abc123",
      })
    ).toEqual({
      token: "[REDACTED]",
      nested: {
        password: "[REDACTED]",
      },
      url: "https://example.com/reset?token=[REDACTED]",
    });
  });
});
