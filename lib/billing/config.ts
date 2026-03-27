import {
  readServerEnv,
  readServerUrlEnv,
  resolveAppEnvironment,
  type AppEnvironment,
} from "@/lib/env";

type BillingEnvSource = Record<string, string | undefined>;

export const stripePlanCatalogKeys = ["starter", "growth"] as const;

export type StripePlanCatalogKey = (typeof stripePlanCatalogKeys)[number];

export type StripePlanCatalogEntry = {
  code: StripePlanCatalogKey;
  stripeProductId: string;
  basePriceId: string;
  meteredPriceId: string;
};

export type StripeBillingConfig = {
  appEnvironment: AppEnvironment;
  secretKey: string;
  webhookSecret: string;
  portalReturnUrl: string;
  checkoutSuccessUrl: string;
  checkoutCancelUrl: string;
  plans: Record<StripePlanCatalogKey, StripePlanCatalogEntry>;
};

export type StripeBillingConfigSnapshot = {
  appEnvironment: AppEnvironment;
  portalReturnUrl: string;
  checkoutSuccessUrl: string;
  checkoutCancelUrl: string;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  planCodes: StripePlanCatalogKey[];
};

function readRequiredBillingEnv(
  name: string,
  source: BillingEnvSource,
  description: string
) {
  return readServerEnv(name, {
    source,
    requirement: "non-test",
    description,
  });
}

function readRequiredBillingUrlEnv(
  name: string,
  source: BillingEnvSource,
  description: string
) {
  return readServerUrlEnv(name, {
    source,
    requirement: "non-test",
    description,
  });
}

function assertValueHasPrefix(
  name: string,
  value: string,
  prefix: string
) {
  if (!value.startsWith(prefix)) {
    throw new Error(`${name} must start with ${prefix}.`);
  }

  return value;
}

function getStripeSecretKey(source: BillingEnvSource) {
  return assertValueHasPrefix(
    "STRIPE_SECRET_KEY",
    readRequiredBillingEnv(
      "STRIPE_SECRET_KEY",
      source,
      "Stripe secret API key."
    ),
    "sk_"
  );
}

function getStripeWebhookSecret(source: BillingEnvSource) {
  return assertValueHasPrefix(
    "STRIPE_WEBHOOK_SECRET",
    readRequiredBillingEnv(
      "STRIPE_WEBHOOK_SECRET",
      source,
      "Stripe webhook signing secret."
    ),
    "whsec_"
  );
}

function getStripeProductId(name: string, source: BillingEnvSource) {
  return assertValueHasPrefix(
    name,
    readRequiredBillingEnv(name, source, "Stripe product identifier."),
    "prod_"
  );
}

function getStripePriceId(name: string, source: BillingEnvSource) {
  return assertValueHasPrefix(
    name,
    readRequiredBillingEnv(name, source, "Stripe price identifier."),
    "price_"
  );
}

function buildPlanCatalogEntry(
  code: StripePlanCatalogKey,
  source: BillingEnvSource
): StripePlanCatalogEntry {
  const upperCode = code.toUpperCase();

  return {
    code,
    stripeProductId: getStripeProductId(
      `STRIPE_${upperCode}_PRODUCT_ID`,
      source
    ),
    basePriceId: getStripePriceId(
      `STRIPE_${upperCode}_BASE_PRICE_ID`,
      source
    ),
    meteredPriceId: getStripePriceId(
      `STRIPE_${upperCode}_METERED_PRICE_ID`,
      source
    ),
  };
}

export function getStripeBillingConfig(
  source: BillingEnvSource = process.env
): StripeBillingConfig {
  const appEnvironment = resolveAppEnvironment(source);

  return {
    appEnvironment,
    secretKey: getStripeSecretKey(source),
    webhookSecret: getStripeWebhookSecret(source),
    portalReturnUrl: readRequiredBillingUrlEnv(
      "STRIPE_PORTAL_RETURN_URL",
      source,
      "Stripe billing portal return URL."
    ),
    checkoutSuccessUrl: readRequiredBillingUrlEnv(
      "STRIPE_CHECKOUT_SUCCESS_URL",
      source,
      "Stripe Checkout success return URL."
    ),
    checkoutCancelUrl: readRequiredBillingUrlEnv(
      "STRIPE_CHECKOUT_CANCEL_URL",
      source,
      "Stripe Checkout cancel return URL."
    ),
    plans: {
      starter: buildPlanCatalogEntry("starter", source),
      growth: buildPlanCatalogEntry("growth", source),
    },
  };
}

export function assertStripeBillingConfiguration(
  source: BillingEnvSource = process.env
): StripeBillingConfigSnapshot {
  const config = getStripeBillingConfig(source);

  return {
    appEnvironment: config.appEnvironment,
    portalReturnUrl: config.portalReturnUrl,
    checkoutSuccessUrl: config.checkoutSuccessUrl,
    checkoutCancelUrl: config.checkoutCancelUrl,
    hasSecretKey: Boolean(config.secretKey),
    hasWebhookSecret: Boolean(config.webhookSecret),
    planCodes: stripePlanCatalogKeys.slice(),
  };
}
