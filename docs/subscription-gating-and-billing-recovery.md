# Subscription Gating And Billing Recovery

This guide explains how Traxium decides whether an organization can use the app, which routes are blocked when billing is not healthy, how the recovery flow works, and which Stripe guardrails fail a release before production deploy.

## Source Of Truth

- Subscription access state is resolved in [lib/billing/access.ts](/Users/atlas/Documents/Traxium/lib/billing/access.ts).
- Guard enforcement lives in [lib/auth.ts](/Users/atlas/Documents/Traxium/lib/auth.ts).
- The blocked billing UX lives in [app/billing-required/page.tsx](/Users/atlas/Documents/Traxium/app/billing-required/page.tsx).
- Recovery actions flow through [app/billing/recover/route.ts](/Users/atlas/Documents/Traxium/app/billing/recover/route.ts), [app/api/billing/checkout/route.ts](/Users/atlas/Documents/Traxium/app/api/billing/checkout/route.ts), and [app/api/billing/portal/route.ts](/Users/atlas/Documents/Traxium/app/api/billing/portal/route.ts).
- Production Stripe deploy safety lives in [lib/billing/config.ts](/Users/atlas/Documents/Traxium/lib/billing/config.ts), [scripts/check-env.ts](/Users/atlas/Documents/Traxium/scripts/check-env.ts), and [scripts/predeploy-check.ts](/Users/atlas/Documents/Traxium/scripts/predeploy-check.ts).

## How Access Is Determined

Traxium always evaluates the active organization, not a global user billing state. `requireUser`, `requireOrganization`, and `bootstrapCurrentUser` all resolve the user first, then read the current organization subscription and map it to a normalized organization access state.

| Stripe / DB subscription status | Additional rule | Organization access state | Blocked? | Reason code |
|---|---|---|---|---|
| `ACTIVE` | None | `active` | No | `active` |
| `TRIALING` | None | `trialing` | No | `trialing` |
| `PAST_DUE` | `currentPeriodEnd` is still in the future | `grace_period` | No | `past_due_grace_period` |
| `PAST_DUE` | `currentPeriodEnd` has passed | `blocked_past_due` | Yes | `past_due_blocked` |
| `UNPAID` | None | `blocked_unpaid` | Yes | `unpaid` |
| `CANCELED` | None | `blocked_canceled` | Yes | `canceled` |
| `PAUSED` | None | `blocked_canceled` | Yes | `paused` |
| `INCOMPLETE` | None | `no_subscription` | Yes | `incomplete` |
| `INCOMPLETE_EXPIRED` | None | `no_subscription` | Yes | `incomplete_expired` |
| No subscription row | None | `no_subscription` | Yes | `no_subscription` |
| Unexpected / unsupported status | Defensive fallback | `blocked_canceled` | Yes | `unknown` |

Important behavior:

- `PAST_DUE` is not immediately blocked while the current billing period is still open.
- `CANCELED`, `UNPAID`, blocked `PAST_DUE`, `PAUSED`, incomplete checkout, and missing subscription all block product access.
- Unexpected or future subscription statuses fail closed into a generic blocked recovery state instead of being treated as active access.
- The access-state result includes the current plan and period metadata so the paywall can render context-aware recovery guidance.

## Where Gating Is Enforced

### App pages

- The authenticated app shell in [app/(app)/layout.tsx](/Users/atlas/Documents/Traxium/app/(app)/layout.tsx) calls `bootstrapCurrentUser()`.
- If the active organization is billing-blocked, the app redirects to `/billing-required`.
- This means normal app pages such as `/dashboard`, `/saving-cards`, `/kanban`, `/reports`, `/timeline`, `/command-center`, and admin pages under `/admin/*` do not render while billing is blocked.

### Server actions and API routes

- `requireUser()` and `requireOrganization()` call the billing guard by default.
- When billing is blocked, API routes return `402` through `createAuthGuardErrorResponse()`.
- The JSON contract includes:
  - `code: "BILLING_REQUIRED"`
  - `accessState`
  - `reasonCode`
  - `billingRequiredPath: "/billing-required"`

This is the contract used by routes such as:

- `/api/auth/bootstrap`
- `/api/command-center`
- `/api/export`
- `/api/saving-cards`
- `/api/upload/evidence`
- `/api/admin/*`

## Which Routes Stay Reachable During Blocked Billing

These routes intentionally bypass the default billing block so the user can recover access safely:

- `/billing-required`
  - The paywall and recovery UI.
- `/billing/recover`
  - Server redirect helper that chooses Stripe portal or checkout recovery.
- `/settings/billing`
  - Stripe return landing page that routes the user back into billing recovery or the app.
- `/api/billing/checkout`
  - Starts Stripe Checkout for admins and owners.
- `/api/billing/portal`
  - Opens the Stripe billing portal for admins and owners.
- `/api/auth/bootstrap`
  - Still reachable, but returns `402` JSON instead of a success payload when the org is blocked.
- Public auth routes such as `/login`, `/logout`, `/forgot-password`, and `/reset-password`
  - These remain available because they are not part of product usage and must not dead-end the user.

Important limits:

- Bypassing the billing block does not bypass organization membership requirements.
- Billing recovery actions are still role-gated. Members can reach the billing-required experience, but only admins and owners can launch recovery actions.

## Billing Recovery Flow

### 1. Detection

- A protected page request hits `bootstrapCurrentUser()` and redirects to `/billing-required`, or
- a protected API route throws `BILLING_REQUIRED` and returns `402` JSON with `billingRequiredPath`.

### 2. Billing-required experience

The page at `/billing-required` reads the organization access state and renders reason-specific copy for:

- `canceled`
- `unpaid`
- `past_due`
- `no subscription`

It also changes guidance by membership role:

- Owners and admins see recovery actions such as:
  - open billing portal
  - update payment method
  - resume or reactivate subscription
  - contact support when configured
- Members see a limited explanation and are told to contact a workspace owner or admin.

### 3. Recovery action dispatch

`POST /billing/recover` is the main recovery router.

- It allows blocked billing state intentionally.
- It still requires a valid organization membership.
- It checks whether the current user can manage organization billing.
- It sends the user to:
  - Stripe Checkout when the organization has no usable subscription yet
  - Stripe Billing Portal when a subscription exists and needs recovery
- If the portal is unavailable, it falls back to checkout when that is the minimum valid recovery path.
- If the workspace is already restored by the time the action runs, it redirects back to `/dashboard`.

### 4. Stripe return path

- Stripe returns to `/settings/billing`.
- If the subscription is active again, that page redirects straight to `/dashboard`.
- If the subscription is still syncing or still blocked, it redirects back to `/billing-required` with a recovery status such as:
  - `processing`
  - `checkout_cancelled`

### 5. Refresh after recovery

- Once webhook sync or billing refresh marks the organization active again, the next refresh or guarded request succeeds.
- The billing-required page stops rendering and the user re-enters the app normally.

## Production Stripe Guardrails

Traxium fails environment validation and predeploy checks instead of logging warnings when billing configuration is unsafe.

### Required checks

- In `APP_ENV=production`, `STRIPE_SECRET_KEY` must be a live `sk_live_` key.
- If `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set in production, it must be a live `pk_live_` key.
- Publishable and secret keys must use the same Stripe mode.
- Required billing env values must be present when billing is enabled:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PORTAL_RETURN_URL`
  - `STRIPE_CHECKOUT_SUCCESS_URL`
  - `STRIPE_CHECKOUT_CANCEL_URL`
  - all configured Stripe product and price ids

### Mixed-mode failures

The deploy guard rejects combinations such as:

- `APP_ENV=production` with `STRIPE_SECRET_KEY=sk_test_*`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_*` in production
- `pk_live_*` paired with `sk_test_*`, or the reverse
- a live secret key paired with obviously non-production catalog ids such as preview, localdev, staging, sample, or test Stripe product and price ids

### Where the failures happen

- `npm run env:check`
  - General environment validation for local, preview, and build flows.
- `npm run predeploy`
  - Preview and production deploy gate. This must pass before release.
- `npm run build`
  - Runs env validation before Next.js build, so unsafe Stripe config fails the build path too.

## Maintenance Checklist

When changing billing, auth guards, or Stripe env handling, update all of these together:

- [lib/billing/access.ts](/Users/atlas/Documents/Traxium/lib/billing/access.ts)
- [lib/auth.ts](/Users/atlas/Documents/Traxium/lib/auth.ts)
- [app/billing-required/page.tsx](/Users/atlas/Documents/Traxium/app/billing-required/page.tsx)
- [app/billing/recover/route.ts](/Users/atlas/Documents/Traxium/app/billing/recover/route.ts)
- [lib/billing/config.ts](/Users/atlas/Documents/Traxium/lib/billing/config.ts)
- [scripts/predeploy-check.ts](/Users/atlas/Documents/Traxium/scripts/predeploy-check.ts)
- this guide
- the regression tests covering billing access, billing-required UX, API `402` responses, and Stripe predeploy safety
