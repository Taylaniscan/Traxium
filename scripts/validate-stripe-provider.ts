import Stripe from "stripe";

import {
  assertStripeBillingConfiguration,
  assertStripeBillingRuntimeConfiguration,
  getStripeBillingRuntimeConfig,
  type StripePlanCatalogEntry,
} from "@/lib/billing/config";

type CheckStatus = "passed" | "failed" | "blocked";

type CheckResult = {
  details?: Record<string, unknown>;
  name: string;
  status: CheckStatus;
};

const EXERCISE_PROVIDER_FLOWS_FLAG = "--exercise-provider-flows";

function buildResult(
  name: string,
  status: CheckStatus,
  details?: Record<string, unknown>
): CheckResult {
  return {
    name,
    status,
    ...(details ? { details } : {}),
  };
}

function readStripeSdkApiVersion() {
  const stripeStatic = Stripe as unknown as {
    API_VERSION?: string;
    DEFAULT_API_VERSION?: string;
  };

  return stripeStatic.DEFAULT_API_VERSION ?? stripeStatic.API_VERSION ?? "unknown";
}

function isDeletedProduct(
  product: Stripe.Product | Stripe.DeletedProduct
): product is Stripe.DeletedProduct {
  return "deleted" in product && product.deleted === true;
}

function getProductIdFromPrice(price: Stripe.Price) {
  return typeof price.product === "string"
    ? price.product
    : price.product.id;
}

function getStripeErrorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      error: "Unknown Stripe error.",
    };
  }

  const stripeError = error as Stripe.errors.StripeError;

  return {
    error: error.message,
    code: stripeError.code ?? null,
    type: stripeError.type ?? null,
    statusCode: stripeError.statusCode ?? null,
  };
}

function validateBasePrice(input: {
  plan: StripePlanCatalogEntry;
  price: Stripe.Price;
  product: Stripe.Product | Stripe.DeletedProduct;
}) {
  const productActive = isDeletedProduct(input.product)
    ? false
    : input.product.active;
  const productMatches = getProductIdFromPrice(input.price) === input.plan.stripeProductId;
  const priceIsRecurring = input.price.type === "recurring";
  const priceIsLicensed = input.price.recurring?.usage_type === "licensed";

  return {
    status:
      productActive &&
      input.price.active &&
      productMatches &&
      priceIsRecurring &&
      priceIsLicensed
        ? "passed"
        : "failed",
    details: {
      planCode: input.plan.code,
      productId: input.plan.stripeProductId,
      productActive,
      priceId: input.plan.basePriceId,
      priceActive: input.price.active,
      priceType: input.price.type,
      usageType: input.price.recurring?.usage_type ?? null,
      interval: input.price.recurring?.interval ?? null,
      intervalCount: input.price.recurring?.interval_count ?? null,
      currency: input.price.currency,
      productMatches,
    },
  } satisfies {
    details: Record<string, unknown>;
    status: CheckStatus;
  };
}

function validateMeteredPrice(input: {
  plan: StripePlanCatalogEntry;
  price: Stripe.Price;
}) {
  const productMatches = getProductIdFromPrice(input.price) === input.plan.stripeProductId;
  const priceIsRecurring = input.price.type === "recurring";
  const priceIsMetered = input.price.recurring?.usage_type === "metered";

  return {
    status:
      input.price.active &&
      productMatches &&
      priceIsRecurring &&
      priceIsMetered
        ? "passed"
        : "failed",
    details: {
      planCode: input.plan.code,
      priceId: input.plan.meteredPriceId,
      priceActive: input.price.active,
      priceType: input.price.type,
      usageType: input.price.recurring?.usage_type ?? null,
      interval: input.price.recurring?.interval ?? null,
      intervalCount: input.price.recurring?.interval_count ?? null,
      currency: input.price.currency,
      productMatches,
    },
  } satisfies {
    details: Record<string, unknown>;
    status: CheckStatus;
  };
}

async function validateCatalog(input: {
  results: CheckResult[];
  stripe: Stripe;
  plans: Record<string, StripePlanCatalogEntry>;
}) {
  for (const plan of Object.values(input.plans)) {
    try {
      const [product, basePrice] = await Promise.all([
        input.stripe.products.retrieve(plan.stripeProductId),
        input.stripe.prices.retrieve(plan.basePriceId, {
          expand: ["product"],
        }),
      ]);
      const baseValidation = validateBasePrice({
        plan,
        product,
        price: basePrice,
      });

      input.results.push(
        buildResult(
          `stripe_catalog_${plan.code}_base_price`,
          baseValidation.status,
          baseValidation.details
        )
      );

      if (!plan.meteredPriceId) {
        input.results.push(
          buildResult(`stripe_catalog_${plan.code}_metered_price`, "passed", {
            planCode: plan.code,
            meteredPriceConfigured: false,
          })
        );
        continue;
      }

      const meteredPrice = await input.stripe.prices.retrieve(plan.meteredPriceId, {
        expand: ["product"],
      });
      const meteredValidation = validateMeteredPrice({
        plan,
        price: meteredPrice,
      });

      input.results.push(
        buildResult(
          `stripe_catalog_${plan.code}_metered_price`,
          meteredValidation.status,
          meteredValidation.details
        )
      );
    } catch (error) {
      input.results.push(
        buildResult(`stripe_catalog_${plan.code}`, "failed", {
          planCode: plan.code,
          ...getStripeErrorDetails(error),
        })
      );
    }
  }
}

async function exerciseProviderFlows(input: {
  appEnvironment: string;
  results: CheckResult[];
  secretKeyMode: "live" | "test";
  stripe: Stripe;
  starterPriceId: string;
  successUrl: string;
  cancelUrl: string;
  portalReturnUrl: string;
}) {
  if (input.secretKeyMode !== "test" || input.appEnvironment === "production") {
    input.results.push(
      buildResult("stripe_provider_flow_exercise", "blocked", {
        reason:
          "Provider flow exercise creates test Stripe objects and only runs with a test key outside production.",
        secretKeyMode: input.secretKeyMode,
        appEnvironment: input.appEnvironment,
      })
    );
    return;
  }

  const customer = await input.stripe.customers.create({
    email: "stripe-step32-validation@example.invalid",
    name: "Traxium Step 32 Validation",
    metadata: {
      source: "traxium_step32_validation",
    },
  });

  input.results.push(
    buildResult("stripe_provider_test_customer_create", "passed", {
      customerId: customer.id,
      livemode: customer.livemode,
    })
  );

  try {
    const session = await input.stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      allow_promotion_codes: true,
      line_items: [
        {
          price: input.starterPriceId,
          quantity: 1,
        },
      ],
      metadata: {
        source: "traxium_step32_validation",
      },
      subscription_data: {
        metadata: {
          source: "traxium_step32_validation",
        },
      },
    });

    input.results.push(
      buildResult("stripe_provider_checkout_session_create", session.url ? "passed" : "failed", {
        checkoutSessionId: session.id,
        livemode: session.livemode,
        mode: session.mode,
        paymentStatus: session.payment_status,
        subscriptionMode: session.mode === "subscription",
        urlReturned: Boolean(session.url),
      })
    );
  } catch (error) {
    input.results.push(
      buildResult("stripe_provider_checkout_session_create", "failed", {
        ...getStripeErrorDetails(error),
      })
    );
  }

  try {
    const portalSession = await input.stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: input.portalReturnUrl,
    });

    input.results.push(
      buildResult("stripe_provider_portal_session_create", portalSession.url ? "passed" : "failed", {
        portalSessionId: portalSession.id,
        livemode: portalSession.livemode,
        urlReturned: Boolean(portalSession.url),
      })
    );
  } catch (error) {
    input.results.push(
      buildResult("stripe_provider_portal_session_create", "failed", {
        ...getStripeErrorDetails(error),
      })
    );
  }
}

async function main() {
  const shouldExerciseProviderFlows = process.argv.includes(
    EXERCISE_PROVIDER_FLOWS_FLAG
  );
  const results: CheckResult[] = [];
  const runtimeSnapshot = assertStripeBillingRuntimeConfiguration();
  const config = getStripeBillingRuntimeConfig();
  const stripe = new Stripe(config.secretKey, {
    appInfo: {
      name: "Traxium",
      version: "0.1.0",
    },
    maxNetworkRetries: 2,
  });

  results.push(
    buildResult("stripe_runtime_configuration", "passed", {
      appEnvironment: runtimeSnapshot.appEnvironment,
      secretKeyMode: runtimeSnapshot.secretKeyMode,
      publishableKeyMode: runtimeSnapshot.publishableKeyMode,
      hasPublishableKey: runtimeSnapshot.hasPublishableKey,
      planCodes: runtimeSnapshot.planCodes,
      stripeSdkApiVersion: readStripeSdkApiVersion(),
    })
  );

  try {
    const fullSnapshot = assertStripeBillingConfiguration();
    results.push(
      buildResult("stripe_webhook_secret_configured", "passed", {
        hasWebhookSecret: fullSnapshot.hasWebhookSecret,
      })
    );
  } catch (error) {
    results.push(
      buildResult("stripe_webhook_secret_configured", "blocked", {
        reason:
          error instanceof Error
            ? error.message
            : "Stripe webhook signing secret could not be validated.",
      })
    );
  }

  await validateCatalog({
    results,
    stripe,
    plans: config.plans,
  });

  if (shouldExerciseProviderFlows) {
    await exerciseProviderFlows({
      appEnvironment: runtimeSnapshot.appEnvironment,
      results,
      secretKeyMode: runtimeSnapshot.secretKeyMode,
      stripe,
      starterPriceId: config.plans.starter.basePriceId,
      successUrl: config.checkoutSuccessUrl,
      cancelUrl: config.checkoutCancelUrl,
      portalReturnUrl: config.portalReturnUrl,
    });
  } else {
    results.push(
      buildResult("stripe_provider_flow_exercise", "blocked", {
        reason: `Run npm run stripe:validate -- ${EXERCISE_PROVIDER_FLOWS_FLAG} to create test-mode Checkout and Portal sessions.`,
      })
    );
  }

  results.push(
    buildResult("stripe_webhook_delivery_cli_or_dashboard", "blocked", {
      reason:
        "Webhook delivery requires a configured STRIPE_WEBHOOK_SECRET and Stripe CLI/dashboard evidence for checkout.session.completed and subscription update events.",
      requiredEvents: [
        "checkout.session.completed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
      ],
    })
  );

  const failed = results.filter((result) => result.status === "failed");
  const blocked = results.filter((result) => result.status === "blocked");
  const summary = {
    event: failed.length ? "stripe.provider.validation.failed" : "stripe.provider.validation.completed",
    appEnvironment: runtimeSnapshot.appEnvironment,
    secretKeyMode: runtimeSnapshot.secretKeyMode,
    passed: results.filter((result) => result.status === "passed").length,
    failed: failed.length,
    blocked: blocked.length,
    providerFlowsExercised: shouldExerciseProviderFlows,
    results,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        event: "stripe.provider.validation.error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
