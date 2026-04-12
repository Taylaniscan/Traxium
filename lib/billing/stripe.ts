import "server-only";

import Stripe from "stripe";

import { getStripeBillingConfig, type StripeBillingConfig } from "@/lib/billing/config";

const globalForStripe = globalThis as unknown as {
  stripeClient: Stripe | undefined;
};

type StripeClientConfig = Pick<StripeBillingConfig, "secretKey">;

export function createStripeClient(config: StripeClientConfig = getStripeBillingConfig()) {
  return new Stripe(config.secretKey, {
    appInfo: {
      name: "Traxium",
      version: "0.1.0",
    },
    maxNetworkRetries: 2,
  });
}

export function getStripeClient(config: StripeClientConfig = getStripeBillingConfig()) {
  if (!globalForStripe.stripeClient) {
    globalForStripe.stripeClient = createStripeClient(config);
  }

  return globalForStripe.stripeClient;
}

export function resetStripeClientForTests() {
  globalForStripe.stripeClient = undefined;
}
