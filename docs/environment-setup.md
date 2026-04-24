# Environment Setup

Traxium uses a mixed server/client environment surface. Only `NEXT_PUBLIC_*` variables are allowed to flow into the browser bundle. All other secrets stay server-only and are read through [lib/env.ts](/Users/atlas/Documents/Traxium/lib/env.ts).

## Environments

Use `APP_ENV` to describe the deployment target:

- `development`: local machine or shared dev box
- `test`: automated tests
- `preview`: preview/staging deployment
- `production`: live deployment

If `APP_ENV` is omitted, Traxium falls back to `NODE_ENV`.

## Required variables

Required in `development`, `preview`, and `production`:

- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Required in `preview` and `production`, and required in `development` only when you want to exercise Stripe-backed billing locally:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PORTAL_RETURN_URL`
- `STRIPE_CHECKOUT_SUCCESS_URL`
- `STRIPE_CHECKOUT_CANCEL_URL`
- `STRIPE_STARTER_PRODUCT_ID`
- `STRIPE_STARTER_BASE_PRICE_ID`
- `STRIPE_STARTER_METERED_PRICE_ID`
- `STRIPE_GROWTH_PRODUCT_ID`
- `STRIPE_GROWTH_BASE_PRICE_ID`
- `STRIPE_GROWTH_METERED_PRICE_ID`

Optional in all environments:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_ANALYTICS_HOST`
- `NEXT_PUBLIC_ANALYTICS_KEY`
- `ANALYTICS_HOST`
- `ANALYTICS_KEY`
- `JOB_WORKER_*`

## Local development

1. Copy `.env.example` to `.env`.
2. Set `APP_ENV=development`.
3. Replace the shipped sample Supabase URL, database URL, and key values with your project-specific values.
4. Fill in:
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Add the Stripe billing values below if you need local checkout, portal, or webhook testing:
   - Optional: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` if a client Stripe integration needs it
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PORTAL_RETURN_URL`
   - `STRIPE_CHECKOUT_SUCCESS_URL`
   - `STRIPE_CHECKOUT_CANCEL_URL`
   - `STRIPE_STARTER_PRODUCT_ID`
   - `STRIPE_STARTER_BASE_PRICE_ID`
   - `STRIPE_STARTER_METERED_PRICE_ID`
   - `STRIPE_GROWTH_PRODUCT_ID`
   - `STRIPE_GROWTH_BASE_PRICE_ID`
   - `STRIPE_GROWTH_METERED_PRICE_ID`
6. Keep `DIRECT_URL` equal to `DATABASE_URL` unless your network can reliably reach the Supabase direct host.
7. Run `npm run env:check` before `npm run dev` or `npm run build`.
8. If you set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, keep it in the same Stripe mode as `STRIPE_SECRET_KEY`.

## Preview

Use `APP_ENV=preview`.

Required:

- All shared required variables above
- `NEXT_PUBLIC_APP_URL` must point to the preview deployment URL
- Preview-safe Stripe product, price, secret, and return URL values must be present for billing routes
- Stripe test keys are allowed in preview, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` may be omitted
- If a publishable key is set, it must stay in the same mode as `STRIPE_SECRET_KEY`

Recommended:

- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- analytics host/key values if preview telemetry is desired

## Production

Use `APP_ENV=production`.

Required:

- All shared required variables above
- Production-safe `NEXT_PUBLIC_APP_URL`
- Live Stripe secret, webhook secret, product ids, price ids, and billing return URLs
- If `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set, it must be a live `pk_live_` key
- Mixed Stripe config is rejected: `sk_test_` secrets, `pk_test_` publishable keys, or preview/local/test catalog IDs paired with live production billing

Recommended:

- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- server analytics overrides if production telemetry should stay off the public ingestion config

## Client-exposed whitelist

Only these variables are intended for browser exposure:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_ANALYTICS_HOST`
- `NEXT_PUBLIC_ANALYTICS_KEY`
- `NEXT_PUBLIC_ANALYTICS_CAPTURE_PATH`
- `NEXT_PUBLIC_ANALYTICS_IDENTIFY_PATH`

Never expose:

- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SENTRY_DSN`
- `ANALYTICS_HOST`
- `ANALYTICS_KEY`

## Worker variables

These are optional and only used by `scripts/run-job-worker.ts`:

- `JOB_WORKER_ONCE`
- `JOB_WORKER_MAX_JOBS`
- `JOB_WORKER_IDLE_DELAY_MS`
- `JOB_WORKER_ORGANIZATION_ID`
- `JOB_WORKER_TYPES`

## Commands

- `npm run env:check`: validates the current environment against Traxium’s required configuration
- `npm run dev`: runs env validation, Prisma generate, and the Next.js dev server
- `npm run build`: runs env validation before the production build
- `npm run jobs:worker`: runs the separate long-lived async worker process
- `npm run jobs:worker:once`: drains the current queue once and exits
- `npm run jobs:worker:healthcheck`: verifies the worker can reach the database and has registered handlers without mutating jobs
