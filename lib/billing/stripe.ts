import "server-only";

import Stripe from "stripe";

import {
  getStripeBillingRuntimeConfig,
  type StripeBillingRuntimeConfig,
} from "@/lib/billing/config";

const globalForStripe = globalThis as unknown as {
  stripeClient: Stripe | undefined;
};

type StripeClientConfig = Pick<StripeBillingRuntimeConfig, "secretKey">;

export function createStripeClient(
  config: StripeClientConfig = getStripeBillingRuntimeConfig()
) {
  return new Stripe(config.secretKey, {
    appInfo: {
      name: "Traxium",
      version: "0.1.0",
    },
    maxNetworkRetries: 2,
  });
}

export function getStripeClient(
  config: StripeClientConfig = getStripeBillingRuntimeConfig()
) {
  if (!globalForStripe.stripeClient) {
    globalForStripe.stripeClient = createStripeClient(config);
  }

  return globalForStripe.stripeClient;
}

export function resetStripeClientForTests() {
  globalForStripe.stripeClient = undefined;
}
