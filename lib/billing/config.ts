import {
  readOptionalClientEnv,
  readServerEnv,
  readServerUrlEnv,
  resolveAppEnvironment,
  type AppEnvironment,
} from "@/lib/env";

type BillingEnvSource = Record<string, string | undefined>;

export const stripePlanCatalogKeys = ["starter", "growth"] as const;
export const stripeBillingRequiredEnvKeys = [
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
] as const;
export const stripeBillingOptionalEnvKeys = [
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
] as const;
export const stripeBillingEnvKeys = [
  ...stripeBillingRequiredEnvKeys,
  ...stripeBillingOptionalEnvKeys,
] as const;

export type StripePlanCatalogKey = (typeof stripePlanCatalogKeys)[number];
export type StripeBillingKeyMode = "live" | "test";

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
  secretKeyMode: StripeBillingKeyMode;
  publishableKeyMode: StripeBillingKeyMode | null;
  portalReturnUrl: string;
  checkoutSuccessUrl: string;
  checkoutCancelUrl: string;
  hasSecretKey: boolean;
  hasPublishableKey: boolean;
  hasWebhookSecret: boolean;
  planCodes: StripePlanCatalogKey[];
};

const nonProductionStripeResourcePrefixes = [
  "price_test",
  "price_preview",
  "price_localdev",
  "price_local",
  "price_dev",
  "price_staging",
  "price_sandbox",
  "price_ci",
  "price_fake",
  "price_sample",
  "price_example",
  "prod_test",
  "prod_preview",
  "prod_localdev",
  "prod_local",
  "prod_dev",
  "prod_staging",
  "prod_sandbox",
  "prod_ci",
  "prod_fake",
  "prod_sample",
  "prod_example",
] as const;

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

function resolveStripeKeyMode(input: {
  livePrefix: string;
  name: string;
  testPrefix: string;
  value: string;
}): StripeBillingKeyMode {
  if (input.value.startsWith(input.livePrefix)) {
    return "live";
  }

  if (input.value.startsWith(input.testPrefix)) {
    return "test";
  }

  throw new Error(
    `${input.name} must start with ${input.testPrefix} or ${input.livePrefix}.`
  );
}

function getStripeSecretKey(source: BillingEnvSource) {
  const value = readRequiredBillingEnv(
    "STRIPE_SECRET_KEY",
    source,
    "Stripe secret API key."
  );

  return {
    value,
    mode: resolveStripeKeyMode({
      name: "STRIPE_SECRET_KEY",
      value,
      testPrefix: "sk_test_",
      livePrefix: "sk_live_",
    }),
  };
}

function getStripePublishableKey(source: BillingEnvSource) {
  const value = readOptionalClientEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", {
    source,
  });

  if (!value) {
    return {
      value: null,
      mode: null,
    };
  }

  return {
    value,
    mode: resolveStripeKeyMode({
      name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      value,
      testPrefix: "pk_test_",
      livePrefix: "pk_live_",
    }),
  };
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

function looksLikeNonProductionStripeResourceId(value: string) {
  const normalized = value.toLowerCase();

  return nonProductionStripeResourcePrefixes.some((prefix) =>
    normalized.startsWith(prefix)
  );
}

function assertStripeModeMatchesEnvironment(input: {
  appEnvironment: AppEnvironment;
  publishableKeyMode: StripeBillingKeyMode | null;
  secretKeyMode: StripeBillingKeyMode;
}) {
  if (
    input.appEnvironment === "production" &&
    input.secretKeyMode !== "live"
  ) {
    throw new Error(
      "STRIPE_SECRET_KEY uses a Stripe test key (sk_test_) while APP_ENV=production. Replace it with a live secret key (sk_live_) before deploying."
    );
  }

  if (
    input.appEnvironment === "production" &&
    input.publishableKeyMode === "test"
  ) {
    throw new Error(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY uses a Stripe test key (pk_test_) while APP_ENV=production. Replace it with a live publishable key (pk_live_) or remove it."
    );
  }

  if (
    input.publishableKeyMode &&
    input.publishableKeyMode !== input.secretKeyMode
  ) {
    throw new Error(
      `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is in Stripe ${input.publishableKeyMode} mode while STRIPE_SECRET_KEY is in ${input.secretKeyMode} mode. Use keys from the same Stripe account mode.`
    );
  }
}

function assertLiveKeyDoesNotUseNonProductionCatalog(
  plans: Record<StripePlanCatalogKey, StripePlanCatalogEntry>,
  secretKeyMode: StripeBillingKeyMode
) {
  if (secretKeyMode !== "live") {
    return;
  }

  const planEntries = Object.values(plans);

  for (const plan of planEntries) {
    const planEnvValues = [
      {
        name: `STRIPE_${plan.code.toUpperCase()}_PRODUCT_ID`,
        value: plan.stripeProductId,
        kind: "product",
      },
      {
        name: `STRIPE_${plan.code.toUpperCase()}_BASE_PRICE_ID`,
        value: plan.basePriceId,
        kind: "price",
      },
      {
        name: `STRIPE_${plan.code.toUpperCase()}_METERED_PRICE_ID`,
        value: plan.meteredPriceId,
        kind: "price",
      },
    ] as const;

    for (const entry of planEnvValues) {
      if (!looksLikeNonProductionStripeResourceId(entry.value)) {
        continue;
      }

      throw new Error(
        `${entry.name} looks like a non-production Stripe ${entry.kind} identifier (${entry.value}) while STRIPE_SECRET_KEY is live. Replace it with the live Stripe ${entry.kind} ID from the production account.`
      );
    }
  }
}

export function hasAnyStripeBillingValue(
  source: BillingEnvSource = process.env
) {
  return stripeBillingEnvKeys.some((key) => Boolean(source[key]?.trim()));
}

export function isStripeBillingConfigured(
  source: BillingEnvSource = process.env
) {
  try {
    getStripeBillingConfig(source);
    return true;
  } catch {
    return false;
  }
}

export function getStripeBillingConfig(
  source: BillingEnvSource = process.env
): StripeBillingConfig {
  const appEnvironment = resolveAppEnvironment(source);
  const secretKey = getStripeSecretKey(source);
  const publishableKey = getStripePublishableKey(source);
  const plans = {
    starter: buildPlanCatalogEntry("starter", source),
    growth: buildPlanCatalogEntry("growth", source),
  } satisfies Record<StripePlanCatalogKey, StripePlanCatalogEntry>;

  assertStripeModeMatchesEnvironment({
    appEnvironment,
    secretKeyMode: secretKey.mode,
    publishableKeyMode: publishableKey.mode,
  });
  assertLiveKeyDoesNotUseNonProductionCatalog(plans, secretKey.mode);

  return {
    appEnvironment,
    secretKey: secretKey.value,
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
    plans,
  };
}

export function assertStripeBillingConfiguration(
  source: BillingEnvSource = process.env
): StripeBillingConfigSnapshot {
  const config = getStripeBillingConfig(source);
  const secretKey = getStripeSecretKey(source);
  const publishableKey = getStripePublishableKey(source);

  return {
    appEnvironment: config.appEnvironment,
    secretKeyMode: secretKey.mode,
    publishableKeyMode: publishableKey.mode,
    portalReturnUrl: config.portalReturnUrl,
    checkoutSuccessUrl: config.checkoutSuccessUrl,
    checkoutCancelUrl: config.checkoutCancelUrl,
    hasSecretKey: Boolean(config.secretKey),
    hasPublishableKey: Boolean(publishableKey.value),
    hasWebhookSecret: Boolean(config.webhookSecret),
    planCodes: stripePlanCatalogKeys.slice(),
  };
}
