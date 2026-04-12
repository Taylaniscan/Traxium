import { describe, expect, it } from "vitest";

import {
  assertEnvironmentConfiguration,
  getDatabaseUrl,
  getPublicAppUrl,
  readClientEnv,
  readClientUrlEnv,
  readServerBooleanEnv,
  resolveAppEnvironment,
} from "@/lib/env";
import { assertCliEnvironmentConfiguration } from "@/scripts/check-env";

function createBaseEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    APP_ENV: "development",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/postgres",
    DIRECT_URL: "postgresql://user:pass@localhost:5432/postgres",
    NEXT_PUBLIC_SUPABASE_URL: "https://localdev.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    ...overrides,
  };
}

function createBillingEnv(overrides: Record<string, string | undefined> = {}) {
  return createBaseEnv({
    STRIPE_SECRET_KEY:
      "sk_test_FAKE",
    STRIPE_WEBHOOK_SECRET:
      "whsec_FAKE",
    STRIPE_PORTAL_RETURN_URL: "http://localhost:3000/settings/billing",
    STRIPE_CHECKOUT_SUCCESS_URL:
      "http://localhost:3000/settings/billing?checkout=success",
    STRIPE_CHECKOUT_CANCEL_URL:
      "http://localhost:3000/settings/billing?checkout=cancelled",
    STRIPE_STARTER_PRODUCT_ID: "prod_localdevstarter2026",
    STRIPE_STARTER_BASE_PRICE_ID: "price_localdevstartermonthly2026",
    STRIPE_STARTER_METERED_PRICE_ID: "price_localdevstarterusage2026",
    STRIPE_GROWTH_PRODUCT_ID: "prod_localdevgrowth2026",
    STRIPE_GROWTH_BASE_PRICE_ID: "price_localdevgrowthmonthly2026",
    STRIPE_GROWTH_METERED_PRICE_ID: "price_localdevgrowthusage2026",
    ...overrides,
  });
}

describe("env configuration helpers", () => {
  it("throws a controlled error when DATABASE_URL is missing in production", () => {
    expect(() =>
      getDatabaseUrl(
        createBaseEnv({
          APP_ENV: "production",
          DATABASE_URL: undefined,
        })
      )
    ).toThrow(
      "Missing DATABASE_URL. Primary Prisma database URL. Required in development, preview, and production environments. Current environment: production."
    );
  });

  it("throws a controlled error when a production-required public URL is missing", () => {
    expect(() =>
      getPublicAppUrl(
        createBaseEnv({
          APP_ENV: "production",
          NEXT_PUBLIC_APP_URL: undefined,
        })
      )
    ).toThrow(
      "Missing NEXT_PUBLIC_APP_URL. Public app base URL used in auth redirects. Required in development, preview, and production environments. Current environment: production."
    );
  });

  it("enforces the client exposure whitelist", () => {
    expect(() =>
      readClientEnv("SUPABASE_SERVICE_ROLE_KEY", {
        source: createBaseEnv(),
      })
    ).toThrow("SUPABASE_SERVICE_ROLE_KEY is not whitelisted for client exposure.");
  });

  it("keeps non-test envs strict but allows test mode to skip non-test requirements", () => {
    expect(
      readClientEnv("NEXT_PUBLIC_APP_URL", {
        source: createBaseEnv({
          APP_ENV: "test",
          NEXT_PUBLIC_APP_URL: undefined,
        }),
      })
    ).toBe("");
  });

  it("normalizes client URLs and rejects malformed values", () => {
    expect(
      readClientUrlEnv("NEXT_PUBLIC_SUPABASE_URL", {
        source: createBaseEnv({
          NEXT_PUBLIC_SUPABASE_URL: "https://localdev.supabase.co///",
        }),
      })
    ).toBe("https://localdev.supabase.co");
    expect(() =>
      readClientUrlEnv("NEXT_PUBLIC_SUPABASE_URL", {
        source: createBaseEnv({
          NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        }),
      })
    ).toThrow("Malformed NEXT_PUBLIC_SUPABASE_URL: not-a-url");
  });

  it("parses boolean-like env values and rejects invalid ones", () => {
    expect(
      readServerBooleanEnv("JOB_WORKER_ONCE", {
        source: createBaseEnv({
          JOB_WORKER_ONCE: "yes",
        }),
      })
    ).toBe(true);
    expect(
      readServerBooleanEnv("JOB_WORKER_ONCE", {
        source: createBaseEnv({
          JOB_WORKER_ONCE: "off",
        }),
      })
    ).toBe(false);
    expect(() =>
      readServerBooleanEnv("JOB_WORKER_ONCE", {
        source: createBaseEnv({
          JOB_WORKER_ONCE: "sometimes",
        }),
      })
    ).toThrow("JOB_WORKER_ONCE must be a boolean-like value.");
  });

  it("rejects unsupported APP_ENV values", () => {
    expect(() =>
      resolveAppEnvironment(
        createBaseEnv({
          APP_ENV: "sandbox",
        })
      )
    ).toThrow(
      'Invalid APP_ENV "sandbox". Use development, test, preview, or production.'
    );
  });

  it("normalizes preview and validates a complete environment snapshot", () => {
    const environment = resolveAppEnvironment(
      createBaseEnv({
        APP_ENV: "staging",
      })
    );
    const snapshot = assertEnvironmentConfiguration(
      createBaseEnv({
        APP_ENV: "preview",
      })
    );

    expect(environment).toBe("preview");
    expect(snapshot).toEqual({
      appEnvironment: "preview",
      publicAppUrl: "http://localhost:3000",
      supabaseUrl: "https://localdev.supabase.co",
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

  it("allows development env checks to skip Stripe billing validation until billing is configured", () => {
    expect(assertCliEnvironmentConfiguration(createBaseEnv())).toEqual({
      appEnvironment: "development",
      publicAppUrl: "http://localhost:3000",
      supabaseUrl: "https://localdev.supabase.co",
      hasSupabaseAnonKey: true,
      hasDatabaseUrl: true,
      hasDirectUrl: true,
      hasServiceRoleKey: true,
      hasServerSentryDsn: false,
      hasClientSentryDsn: false,
      hasServerAnalytics: false,
      hasClientAnalytics: false,
      storageBucket: "evidence-private",
      billing: null,
    });
  });

  it("requires Stripe billing env values for preview cli validation", () => {
    expect(() =>
      assertCliEnvironmentConfiguration(
        createBaseEnv({
          APP_ENV: "preview",
        })
      )
    ).toThrow(
      "Missing STRIPE_SECRET_KEY. Stripe secret API key. Required in development, preview, and production environments. Current environment: preview."
    );

    expect(
      assertCliEnvironmentConfiguration(
        createBillingEnv({
          APP_ENV: "preview",
        })
      )
    ).toEqual({
      appEnvironment: "preview",
      publicAppUrl: "http://localhost:3000",
      supabaseUrl: "https://localdev.supabase.co",
      hasSupabaseAnonKey: true,
      hasDatabaseUrl: true,
      hasDirectUrl: true,
      hasServiceRoleKey: true,
      hasServerSentryDsn: false,
      hasClientSentryDsn: false,
      hasServerAnalytics: false,
      hasClientAnalytics: false,
      storageBucket: "evidence-private",
      billing: {
        appEnvironment: "preview",
        secretKeyMode: "test",
        publishableKeyMode: null,
        portalReturnUrl: "http://localhost:3000/settings/billing",
        checkoutSuccessUrl:
          "http://localhost:3000/settings/billing?checkout=success",
        checkoutCancelUrl:
          "http://localhost:3000/settings/billing?checkout=cancelled",
        hasSecretKey: true,
        hasPublishableKey: false,
        hasWebhookSecret: true,
        planCodes: ["starter", "growth"],
      },
    });
  });
});
