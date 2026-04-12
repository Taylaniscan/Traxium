import { describe, expect, it } from "vitest";

import { assertStripeBillingConfiguration } from "@/lib/billing/config";
import { assertPredeployConfiguration } from "@/scripts/predeploy-check";

function createJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${header}.${body}.signature`;
}

function createBillingEnv(
  overrides: Record<string, string | undefined> = {}
) {
  return {
    APP_ENV: "development",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "https://localdev.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/postgres",
    DIRECT_URL: "postgresql://user:pass@localhost:5432/postgres",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
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
  };
}

function createDeployEnv(
  overrides: Record<string, string | undefined> = {}
) {
  const projectRef = overrides.PROJECT_REF ?? "previewproj";
  const source: Record<string, string | undefined> = {
    APP_ENV: "preview",
    NEXT_PUBLIC_APP_URL: "https://preview-traxium.vercel.app",
    DATABASE_URL:
      `postgresql://postgres.${projectRef}:secret@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30`,
    DIRECT_URL:
      `postgresql://postgres.${projectRef}:secret@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30`,
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: createJwt({
      role: "anon",
      ref: projectRef,
    }),
    SUPABASE_SERVICE_ROLE_KEY: createJwt({
      role: "service_role",
      ref: projectRef,
    }),
    STRIPE_SECRET_KEY:
      "sk_test_FAKE",
    STRIPE_WEBHOOK_SECRET:
      "whsec_FAKE",
    STRIPE_PORTAL_RETURN_URL: "https://preview-traxium.vercel.app/admin/settings",
    STRIPE_CHECKOUT_SUCCESS_URL:
      "https://preview-traxium.vercel.app/admin/settings?checkout=success",
    STRIPE_CHECKOUT_CANCEL_URL:
      "https://preview-traxium.vercel.app/admin/settings?checkout=cancelled",
    STRIPE_STARTER_PRODUCT_ID: "prod_previewcistarter2026",
    STRIPE_STARTER_BASE_PRICE_ID: "price_previewcistartermonthly2026",
    STRIPE_STARTER_METERED_PRICE_ID: "price_previewcistarterusage2026",
    STRIPE_GROWTH_PRODUCT_ID: "prod_previewcigrowth2026",
    STRIPE_GROWTH_BASE_PRICE_ID: "price_previewcigrowthmonthly2026",
    STRIPE_GROWTH_METERED_PRICE_ID: "price_previewcigrowthusage2026",
    VERCEL_ENV: "preview",
    VERCEL_URL: "preview-traxium.vercel.app",
    VERCEL_PROJECT_PRODUCTION_URL: "app.traxium.com",
    ...overrides,
  };

  delete source.PROJECT_REF;

  return source;
}

describe("Stripe billing safety validation", () => {
  it("fails production deployments that still use sk_test_", () => {
    expect(() =>
      assertPredeployConfiguration(
        createDeployEnv({
          APP_ENV: "production",
          VERCEL_ENV: "production",
          NEXT_PUBLIC_APP_URL: "https://app.traxium.com",
          PROJECT_REF: "prodproj",
          STRIPE_SECRET_KEY:
            "sk_test_FAKE",
        })
      )
    ).toThrow(
      "STRIPE_SECRET_KEY uses a Stripe test key (sk_test_) while APP_ENV=production. Replace it with a live secret key (sk_live_) before deploying."
    );
  });

  it("passes production validation with sk_live_ and live-looking catalog ids", () => {
    expect(
      assertPredeployConfiguration(
        createDeployEnv({
          APP_ENV: "production",
          VERCEL_ENV: "production",
          NEXT_PUBLIC_APP_URL: "https://app.traxium.com",
          PROJECT_REF: "prodproj",
          STRIPE_SECRET_KEY:
            "sk_live_FAKE",
          STRIPE_STARTER_PRODUCT_ID: "prod_1starterlivecatalog2026",
          STRIPE_STARTER_BASE_PRICE_ID: "price_1starterlivecatalog2026",
          STRIPE_STARTER_METERED_PRICE_ID: "price_1starterlivelogusage2026",
          STRIPE_GROWTH_PRODUCT_ID: "prod_1growthlivecatalog2026",
          STRIPE_GROWTH_BASE_PRICE_ID: "price_1growthlivecatalog2026",
          STRIPE_GROWTH_METERED_PRICE_ID: "price_1growthlivelogusage2026",
        })
      )
    ).toMatchObject({
      appEnvironment: "production",
      stripeKeyMode: "live",
    });
  });

  it("allows sk_test_ in preview and development", () => {
    expect(
      assertStripeBillingConfiguration(
        createBillingEnv({
          APP_ENV: "preview",
        })
      )
    ).toMatchObject({
      appEnvironment: "preview",
      secretKeyMode: "test",
    });

    expect(
      assertStripeBillingConfiguration(
        createBillingEnv({
          APP_ENV: "development",
        })
      )
    ).toMatchObject({
      appEnvironment: "development",
      secretKeyMode: "test",
    });
  });

  it("fails when required billing env values are missing in production", () => {
    expect(() =>
      assertStripeBillingConfiguration(
        createBillingEnv({
          APP_ENV: "production",
          STRIPE_SECRET_KEY:
            "sk_live_FAKE",
          STRIPE_STARTER_PRODUCT_ID: "prod_1starterlivecatalog2026",
          STRIPE_STARTER_BASE_PRICE_ID: "price_1starterlivecatalog2026",
          STRIPE_STARTER_METERED_PRICE_ID: "price_1starterlivelogusage2026",
          STRIPE_GROWTH_PRODUCT_ID: "prod_1growthlivecatalog2026",
          STRIPE_GROWTH_BASE_PRICE_ID: "price_1growthlivecatalog2026",
          STRIPE_GROWTH_METERED_PRICE_ID: "price_1growthlivelogusage2026",
          STRIPE_PORTAL_RETURN_URL: undefined,
        })
      )
    ).toThrow(
      "Missing STRIPE_PORTAL_RETURN_URL. Stripe billing portal return URL. Required in development, preview, and production environments. Current environment: production."
    );
  });

  it("fails mixed-mode config when a live secret is paired with preview/test catalog ids", () => {
    expect(() =>
      assertStripeBillingConfiguration(
        createBillingEnv({
          APP_ENV: "production",
          STRIPE_SECRET_KEY:
            "sk_live_FAKE",
          STRIPE_STARTER_PRODUCT_ID: "prod_1starterlivecatalog2026",
          STRIPE_STARTER_BASE_PRICE_ID: "price_previewcistartermonthly2026",
          STRIPE_STARTER_METERED_PRICE_ID: "price_1starterlivelogusage2026",
          STRIPE_GROWTH_PRODUCT_ID: "prod_1growthlivecatalog2026",
          STRIPE_GROWTH_BASE_PRICE_ID: "price_1growthlivecatalog2026",
          STRIPE_GROWTH_METERED_PRICE_ID: "price_1growthlivelogusage2026",
        })
      )
    ).toThrow(
      "STRIPE_STARTER_BASE_PRICE_ID looks like a non-production Stripe price identifier (price_previewcistartermonthly2026) while STRIPE_SECRET_KEY is live. Replace it with the live Stripe price ID from the production account."
    );
  });

  it("returns helpful error messages for publishable-key mismatches", () => {
    expect(() =>
      assertStripeBillingConfiguration(
        createBillingEnv({
          APP_ENV: "preview",
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
            "pk_live_FAKE",
        })
      )
    ).toThrow(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is in Stripe live mode while STRIPE_SECRET_KEY is in test mode. Use keys from the same Stripe account mode."
    );
  });
});
