# Release Checklist

This checklist keeps PRs, merges, and deployments aligned with Traxium's CI quality gates.

## PR Before Opening

- Rebase or merge the latest target branch changes.
- Run `npm run env:check` with a valid local `.env`.
- Run `npm run db:generate`.
- Run `npm run db:validate`.
- Run `npm run typecheck`.
- Run `npm run test`.
- Run `npm run build`.
- Confirm any Prisma schema change has a matching migration and that the generated app behavior still matches the active organization and RBAC rules.

## Merge Before Approval

- Confirm the `CI` GitHub Actions workflow passed on the latest commit.
- Review failures as hard blockers for merge:
  - dependency install failure
  - environment contract failure
  - Prisma generate or schema validation failure
  - typecheck failure
  - test failure
  - production build failure
- Verify auth, onboarding, admin, observability, and async jobs changes include tests when behavior changed.
- Verify no server secret was moved into a `NEXT_PUBLIC_*` variable.
- Verify `.env.example` and [environment-setup.md](/Users/atlas/Documents/Traxium/docs/environment-setup.md) still reflect the current config contract if env usage changed.
- Verify [subscription-gating-and-billing-recovery.md](/Users/atlas/Documents/Traxium/docs/subscription-gating-and-billing-recovery.md) still matches the current access-state mapping, blocked-route contract, billing recovery flow, and Stripe deploy guard behavior if billing or auth guards changed.
- Verify [billing-access-staging-qa.md](/Users/atlas/Documents/Traxium/docs/billing-access-staging-qa.md) still matches the real blocked-billing, recovery, multi-org, and release-verification workflow before preview signoff.

## Deploy Before Release

- Confirm the deployment platform has the required production env values:
  - `APP_ENV=production`
  - `NEXT_PUBLIC_APP_URL`
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
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
- Confirm Stripe mode safety before release:
  - `STRIPE_SECRET_KEY` must be a live `sk_live_` key
  - if `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set, it must be a live `pk_live_` key
  - publishable and secret keys must stay in the same Stripe mode
  - production must not use preview/local/test Stripe catalog IDs
- Confirm optional runtime integrations are intentional:
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `SENTRY_DSN`
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `ANALYTICS_HOST`
  - `ANALYTICS_KEY`
  - `NEXT_PUBLIC_ANALYTICS_HOST`
  - `NEXT_PUBLIC_ANALYTICS_KEY`
- Confirm the migration plan is clear before deploy:
  - schema-only change with existing migrations already committed, or
  - deploy includes the required Prisma migration rollout
- Confirm worker runtime configuration is present if async email or telemetry jobs must process immediately after release.

## CI Env Strategy

The GitHub Actions workflow uses secret-free, structurally valid env values so that config validation, Prisma generation, tests, and the build can run without production credentials.

- Fake Supabase keys are JWT-shaped and carry the expected `anon` or `service_role` claims.
- Database URLs point to a syntactically valid Supabase-style pooler host and satisfy Prisma env guards.
- Empty Sentry and analytics values are allowed because those integrations are optional and fail open.

If CI starts failing after an env contract change, update all of the following together:

- [lib/env.ts](/Users/atlas/Documents/Traxium/lib/env.ts)
- [.github/workflows/ci.yml](/Users/atlas/Documents/Traxium/.github/workflows/ci.yml)
- [.env.example](/Users/atlas/Documents/Traxium/.env.example)
- [environment-setup.md](/Users/atlas/Documents/Traxium/docs/environment-setup.md)
