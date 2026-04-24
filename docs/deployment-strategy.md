# Deployment Strategy

Traxium uses a split deployment model: preview deployments are for validation against isolated non-production services, and production deployments are reserved for live traffic only. The release guard in [scripts/predeploy-check.ts](/Users/atlas/Documents/Traxium/scripts/predeploy-check.ts) is the enforcement point for that split.

## Async Worker Requirement

- Traxium async jobs are not processed by the Next.js web server.
- Every preview and production environment must run two deployables against the same database and environment configuration:
  - web: the Next.js application
  - worker: a separate long-lived process running `npm run jobs:worker`
- The worker is required for:
  - invitation email delivery
  - password recovery email delivery
  - analytics queue processing
  - observability queue processing
- After deploying or restarting the worker, run `npm run jobs:worker:healthcheck` in the worker environment to verify database access, registered handlers, and visible due queue state without mutating jobs.
- Use `npm run jobs:worker:once` only for controlled one-shot draining, deterministic retry follow-up, or preview diagnostics.

## Local

- Use `APP_ENV=development`.
- Run `npm run env:check` before `npm run dev`.
- Run `npm run jobs:worker` in a second terminal if you need invitation, password recovery, analytics, or observability jobs to process locally.
- Use `npm run db:migrate:dev` only in local development.
- Never point local `.env` at production Supabase or production PostgreSQL.

## Preview

- Use `APP_ENV=preview`.
- Preview deployments must use preview-safe values for:
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
- Preview must never reuse the production app domain.
- Preview must never point at local hosts or example/template credentials.
- On Vercel, keep `VERCEL_ENV=preview` aligned with `APP_ENV=preview`.
- Run `npm run predeploy` before allowing the build to continue.
- Deploy the worker separately with `npm run jobs:worker`.
- Run `npm run jobs:worker:healthcheck` after the worker starts.
- For queue validation during preview release checks, `npm run jobs:worker:once` is the safe one-shot verification command.

## Production

- Use `APP_ENV=production`.
- Production deployments must use the production application domain and live Supabase project.
- Production deployments must also use live Stripe billing secrets, return URLs, product ids, and price ids.
- `STRIPE_SECRET_KEY` must be `sk_live_`, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` must be `pk_live_` if it is set.
- The predeploy guard rejects mixed Stripe mode config such as test keys in production or preview/local/test catalog IDs paired with a live secret.
- Keep [subscription-gating-and-billing-recovery.md](/Users/atlas/Documents/Traxium/docs/subscription-gating-and-billing-recovery.md) aligned with deploy behavior whenever billing access or recovery flow changes.
- On Vercel, keep `VERCEL_ENV=production` aligned with `APP_ENV=production`.
- Run `npm run release:verify` before approving a production release.
- Production builds should use [vercel.json](/Users/atlas/Documents/Traxium/vercel.json) so the predeploy guard runs before `next build`.
- Production rollout is incomplete until the separate worker process is deployed with `npm run jobs:worker`.
- Run `npm run jobs:worker:healthcheck` from the worker environment after deploy and after any worker restart.
- Maintain at least one healthy worker replica before enabling or announcing the release, otherwise invitation and password recovery delivery will stall even if the web deployment looks healthy.

## Migration Strategy

- `prisma migrate dev` is for local development only.
- Never use `prisma migrate dev` against preview or production databases.
- Preview and production rollout must use `prisma migrate deploy`.
- The repo script for live-safe rollout is `npm run release:migrate`.
- Recommended release order:
  1. `npm run release:verify`
  2. `npm run release:migrate`
  3. deploy the web application build
  4. deploy or restart the worker with `npm run jobs:worker`
  5. run `npm run jobs:worker:healthcheck`

## Rollback Notes

- Application rollback is a separate concern from database rollback.
- If the app build is bad but schema is still compatible, roll back the deployment first.
- If a migration introduced an unsafe schema change, prefer a forward corrective migration or restore from a verified backup rather than attempting ad hoc manual edits.
- Keep preview validated on the target migration set before production rollout so rollback decisions stay operationally simple.
