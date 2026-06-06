# Stripe Provider Validation

This document records the Step 32 validation contract for Stripe Billing. The app uses Stripe Billing APIs with subscription-mode Checkout Sessions for initial setup and the Stripe Customer Portal for self-service recovery.

For release signoff, use [provider-flow-validation.md](/Users/atlas/Documents/Traxium/docs/provider-flow-validation.md) as the master Gap 1 checklist. This Stripe-specific document remains the detailed reference for catalog, Checkout, Portal, webhook, and billing recovery provider proof.

## Provider Validation Commands

Run the read-only provider check with the configured local or preview Stripe test-mode env:

```bash
npm run stripe:validate
```

The default command does not create Stripe objects. It checks:

- Stripe runtime configuration without printing secret values.
- Stripe key mode and SDK API version.
- Whether the webhook signing secret is configured.
- Starter and Growth product IDs exist in Stripe.
- Starter and Growth base Price IDs are active recurring licensed Prices.
- Each base Price belongs to the configured Product.
- Optional metered Prices, when configured, are active recurring metered Prices for the same Product.

To exercise provider handoff creation in a non-production test-mode Stripe account:

```bash
npm run stripe:validate -- --exercise-provider-flows
```

This guarded mode only runs when `STRIPE_SECRET_KEY` is a test key and `APP_ENV` is not `production`. It creates a test customer, a subscription-mode Checkout Session, and a Billing Portal Session. It does not complete payment, mutate app database records, or call local app routes.

## Current Local Provider Result

The latest local run used Stripe test mode with SDK API version `2026-03-25.dahlia`.

Observed provider checks:

- Runtime config passed with plans `starter` and `growth`.
- Starter Product and base Price passed: active Product, active recurring licensed monthly USD Price, Product matched.
- Growth Product and base Price passed: active Product, active recurring licensed monthly USD Price, Product matched.
- Metered Prices are not configured for either plan, which is valid for the current catalog.
- Test customer creation passed.
- Subscription-mode Checkout Session creation passed.
- Billing Portal Session creation passed.

Blocked provider checks:

- `STRIPE_WEBHOOK_SECRET` is empty in the current local env.
- Stripe CLI/dashboard delivery proof for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted` still needs to be recorded with a real webhook signing secret.

## Billing State Matrix

Local automated coverage proves the state matrix below. Preview signoff should observe or simulate each state with Stripe test-mode data before paid pilots.

| State | Access result | Recovery target | Required proof |
|---|---|---|---|
| `active` | App access allowed | Portal for billing management | Automated plus preview browser check |
| `trialing` | App access allowed | Portal unless placeholder trial needs Checkout | Automated plus preview browser check |
| `past_due` with future period end | Grace-period app access allowed | Portal if recovery is requested | Automated plus preview browser check |
| `past_due` after period end | Blocked at `/billing-required` | Portal | Automated plus preview/Stripe state check |
| `unpaid` | Blocked at `/billing-required` | Portal | Automated plus preview/Stripe state check |
| `canceled` | Blocked at `/billing-required` | Portal or Checkout fallback when customer is invalid | Automated plus preview/Stripe state check |
| `paused` | Blocked at `/billing-required` | Portal | Automated plus preview/Stripe state check |
| `incomplete` | Blocked as `no_subscription` | Checkout | Automated plus preview/Stripe state check |
| `incomplete_expired` | Blocked as `no_subscription` | Checkout | Automated plus preview/Stripe state check |
| no subscription row | Blocked as `no_subscription`, unless a workspace trial is still active | Checkout | Automated plus preview browser check |

## App-Side Coverage

Relevant automated tests:

- `tests/lib/stripe-config.test.ts`
- `tests/lib/stripe-billing-safety.test.ts`
- `tests/lib/billing-access.test.ts`
- `tests/api/billing-checkout.test.ts`
- `tests/api/billing-recover.route.test.ts`
- `tests/api/stripe-webhook.test.ts`
- `tests/app/billing-required.page.test.ts`
- `tests/app/settings-billing.page.test.ts`
- `tests/components/workspace-billing-settings-card.test.ts`
- `tests/integration/subscription-gating-regression.test.ts`
- `tests/docs/billing-access-staging-qa.test.ts`
- `tests/docs/subscription-gating-docs.test.ts`

These prove app-side behavior, state mapping, route permissions, webhook processing, and deploy guards. They do not prove Stripe dashboard webhook delivery by themselves.

## Manual Stripe Proof Still Required

Before calling Stripe fully provider-proven in the master proof log, record:

1. `STRIPE_WEBHOOK_SECRET` configured for the preview/local webhook endpoint.
2. Stripe CLI or Dashboard delivery of `checkout.session.completed` to `/api/billing/webhook`.
3. Stripe CLI or Dashboard delivery of `customer.subscription.created`.
4. Stripe CLI or Dashboard delivery of `customer.subscription.updated` for `active`, `trialing`, `past_due`, `unpaid`, and `paused` where available.
5. Stripe CLI or Dashboard delivery of `customer.subscription.deleted` or a canceled subscription update.
6. Database evidence that the webhook synced the expected `BillingCustomer`, `Subscription`, and `WebhookEvent` rows.
7. Browser evidence that restored active billing clears `/billing-required` and returns to `/dashboard`.
