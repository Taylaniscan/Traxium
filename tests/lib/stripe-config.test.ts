import Stripe from "stripe";
import {
  afterEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";

vi.mock("server-only", () => ({}));

import {
  assertStripeBillingConfiguration,
  getMissingStripeBillingEnvKeys,
  getStripeBillingConfig,
  getStripeBillingRuntimeConfig,
  isStripeBillingConfigured,
  stripeBillingOptionalEnvKeys,
  stripeBillingOptionalServerEnvKeys,
  stripeBillingRequiredEnvKeys,
  stripeBillingRuntimeRequiredEnvKeys,
  stripeBillingWebhookRequiredEnvKeys,
  type StripeBillingConfig,
  type StripeBillingRuntimeConfig,
} from "@/lib/billing/config";
import {
  createStripeClient,
  getStripeClient,
  resetStripeClientForTests,
} from "@/lib/billing/stripe";

function createBillingEnv(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    APP_ENV: "development",
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

describe("Stripe billing config", () => {
  afterEach(() => {
    resetStripeClientForTests();
  });

  it("keeps the required Stripe billing env source of truth explicit", () => {
    expect(stripeBillingRuntimeRequiredEnvKeys).toEqual([
      "STRIPE_SECRET_KEY",
      "STRIPE_PORTAL_RETURN_URL",
      "STRIPE_CHECKOUT_SUCCESS_URL",
      "STRIPE_CHECKOUT_CANCEL_URL",
      "STRIPE_STARTER_PRODUCT_ID",
      "STRIPE_STARTER_BASE_PRICE_ID",
      "STRIPE_GROWTH_PRODUCT_ID",
      "STRIPE_GROWTH_BASE_PRICE_ID",
    ]);
    expect(stripeBillingWebhookRequiredEnvKeys).toEqual([
      "STRIPE_WEBHOOK_SECRET",
    ]);
    expect(stripeBillingOptionalServerEnvKeys).toEqual([
      "STRIPE_STARTER_METERED_PRICE_ID",
      "STRIPE_GROWTH_METERED_PRICE_ID",
    ]);
    expect(stripeBillingRequiredEnvKeys).toEqual([
      ...stripeBillingRuntimeRequiredEnvKeys,
      ...stripeBillingWebhookRequiredEnvKeys,
    ]);
    expect(stripeBillingOptionalEnvKeys).toEqual([
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    ]);
    expect(
      stripeBillingRequiredEnvKeys.every((key) => !key.startsWith("NEXT_PUBLIC_"))
    ).toBe(true);
  });

  it("throws a controlled error when required Stripe env values are missing", () => {
    expect(() =>
      getStripeBillingConfig(
        createBillingEnv({
          APP_ENV: "production",
          STRIPE_SECRET_KEY: undefined,
        })
      )
    ).toThrow(
      "Missing STRIPE_SECRET_KEY. Stripe secret API key. Required in development, preview, and production environments. Current environment: production."
    );
  });

  it("reports all missing billing env keys without exposing configured secret values", () => {
    const source = {
      APP_ENV: "preview",
    };

    expect(getMissingStripeBillingEnvKeys(source)).toEqual(
      stripeBillingRuntimeRequiredEnvKeys
    );
    expect(getMissingStripeBillingEnvKeys(source, "full")).toEqual(
      stripeBillingRequiredEnvKeys
    );

    let message = "";

    try {
      getStripeBillingConfig(source);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain(
      `Missing Stripe billing environment variables: ${stripeBillingRequiredEnvKeys.join(", ")}.`
    );
    expect(message).not.toContain("sk_test_");
    expect(message).not.toContain("sk_live_");
    expect(message).not.toContain("whsec_");
  });

  it("does not echo invalid secret values in validation errors", () => {
    const source = createBillingEnv({
      STRIPE_SECRET_KEY: "not-a-stripe-secret",
    });

    let message = "";

    try {
      getStripeBillingConfig(source);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain(
      "STRIPE_SECRET_KEY must start with sk_test_ or sk_live_."
    );
    expect(message).not.toContain("not-a-stripe-secret");
  });

  it("normalizes and validates the Stripe billing configuration shape", () => {
    const config = getStripeBillingConfig(
      createBillingEnv({
        STRIPE_PORTAL_RETURN_URL: "http://localhost:3000/settings/billing///",
      })
    );

    expect(config).toEqual({
      appEnvironment: "development",
      secretKey: "sk_test_FAKE",
      webhookSecret:
        "whsec_FAKE",
      portalReturnUrl: "http://localhost:3000/settings/billing",
      checkoutSuccessUrl:
        "http://localhost:3000/settings/billing?checkout=success",
      checkoutCancelUrl:
        "http://localhost:3000/settings/billing?checkout=cancelled",
      plans: {
        starter: {
          code: "starter",
          stripeProductId: "prod_localdevstarter2026",
          basePriceId: "price_localdevstartermonthly2026",
          meteredPriceId: "price_localdevstarterusage2026",
        },
        growth: {
          code: "growth",
          stripeProductId: "prod_localdevgrowth2026",
          basePriceId: "price_localdevgrowthmonthly2026",
          meteredPriceId: "price_localdevgrowthusage2026",
        },
      },
    });
    expect(assertStripeBillingConfiguration(createBillingEnv())).toEqual({
      appEnvironment: "development",
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
    });

    expectTypeOf(config).toMatchTypeOf<StripeBillingConfig>();
    expectTypeOf(getStripeBillingRuntimeConfig(createBillingEnv())).toMatchTypeOf<
      StripeBillingRuntimeConfig
    >();
    expectTypeOf(config.plans.starter.code).toEqualTypeOf<
      StripeBillingConfig["plans"]["starter"]["code"]
    >();
  });

  it("requires product and licensed base price IDs for Starter and Growth", () => {
    expect(() =>
      getStripeBillingConfig(
        createBillingEnv({
          STRIPE_GROWTH_BASE_PRICE_ID: undefined,
        })
      )
    ).toThrow(
      "Missing STRIPE_GROWTH_BASE_PRICE_ID. Stripe price identifier. Required in development, preview, and production environments. Current environment: development."
    );
    expect(() =>
      getStripeBillingConfig(
        createBillingEnv({
          STRIPE_STARTER_PRODUCT_ID: "price_wrong_prefix",
        })
      )
    ).toThrow("STRIPE_STARTER_PRODUCT_ID must start with prod_.");
  });

  it("allows metered prices to be omitted for simple subscription catalog setup", () => {
    const config = getStripeBillingRuntimeConfig(
      createBillingEnv({
        STRIPE_STARTER_METERED_PRICE_ID: undefined,
        STRIPE_GROWTH_METERED_PRICE_ID: undefined,
      })
    );

    expect(config.plans.starter.meteredPriceId).toBeNull();
    expect(config.plans.growth.meteredPriceId).toBeNull();
  });

  it("reports whether Stripe billing is fully configured without throwing", () => {
    expect(isStripeBillingConfigured(createBillingEnv())).toBe(true);
    expect(
      isStripeBillingConfigured(
        createBillingEnv({
          STRIPE_SECRET_KEY: undefined,
        })
      )
    ).toBe(false);
  });

  it("creates and caches a Stripe client through the shared helper", () => {
    const config = getStripeBillingConfig(createBillingEnv());
    const client = createStripeClient(config);
    const singletonA = getStripeClient(config);
    const singletonB = getStripeClient(config);

    expect(client).toBeInstanceOf(Stripe);
    expect(singletonA).toBeInstanceOf(Stripe);
    expect(singletonA).toBe(singletonB);
    expect(singletonA).not.toBe(client);
  });
});
