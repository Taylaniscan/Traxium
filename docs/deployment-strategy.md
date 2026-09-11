# Deployment Strategy

Traxium uses a split deployment model: preview deployments are for validation against isolated non-production services, and production deployments are reserved for live traffic only. The release guard in [scripts/predeploy-check.ts](../scripts/predeploy-check.ts) is the enforcement point for that split.

## Async Worker Execution

Traxium async jobs are not processed by the Next.js request/response cycle. They are
enqueued by the web app and drained by a job worker. Async processing is required for:

- invitation email delivery
- password recovery email delivery
- analytics queue processing
- observability queue processing

There are two supported execution modes. They share the exact same job-runner logic
(`lib/job-runner.ts` + `lib/job-handlers.ts`); only the trigger differs.

### Mode A — Vercel cron (default)

This is the default for the standard Vercel deployment (the repo ships only the web app).

- `vercel.json` defines a cron that invokes `GET /api/jobs/run` every 5 minutes.
- `app/api/jobs/run/route.ts` executes one bounded worker pass (`--once` semantics):
  it drains up to 25 jobs and stops when the queue is empty or a ~50s wall-clock budget
  is reached, keeping it well within the serverless function timeout.
- The endpoint is protected by a shared secret. Set `JOB_RUNNER_SECRET` in the Vercel
  project environment, and set `CRON_SECRET` to the **same value** — Vercel attaches
  `Authorization: Bearer <CRON_SECRET>` to scheduled cron requests, which the endpoint
  accepts. Requests without the matching secret are rejected (401), and the endpoint is
  disabled (503) until `JOB_RUNNER_SECRET` is configured.
- The route records a heartbeat after each successful pass; the admin Job Health page
  shows the last successful pass and warns if it is older than 30 minutes.

### Mode B — Dedicated worker (self-hosted)

For teams that host their own long-lived worker (e.g. a container or a separate
always-on process) instead of, or in addition to, the Vercel cron:

- Run `npm run jobs:worker` as a separate long-lived process against the same database
  and environment configuration as the web app.
- After deploying or restarting it, run `npm run jobs:worker:healthcheck` to verify
  database access, registered handlers, and visible due queue state without mutating jobs.
- Use `npm run jobs:worker:once` for controlled one-shot draining, deterministic retry
  follow-up, or preview diagnostics.
- If you run a dedicated worker as the primary processor, you may remove the cron entry
  from `vercel.json`. Running both is safe (jobs are reserved atomically), but redundant.

## Local

- Use `APP_ENV=development`.
- Run `npm run env:check` before `npm run dev`.
- Run `npm run jobs:worker` in a second terminal if you need invitation, password recovery, analytics, or observability jobs to process locally.
- Use `npm run db:migrate:dev` only in local development.
- Never point local `.env` at production Supabase or production PostgreSQL.

## Preview

- Use `APP_ENV=preview`.
- Use [provider-flow-validation.md](provider-flow-validation.md) as the release gate for preview provider proof. Preview must pass or explicitly block the documented invite email, password reset, Stripe Checkout, Stripe Billing Portal, Stripe webhook, evidence upload/download, import/export, and worker health checks before paid-pilot signoff.
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
  - `STRIPE_GROWTH_PRODUCT_ID`
  - `STRIPE_GROWTH_BASE_PRICE_ID`
- Preview must never reuse the production app domain.
- Preview must never point at local hosts or example/template credentials.
- Add `STRIPE_STARTER_METERED_PRICE_ID` and `STRIPE_GROWTH_METERED_PRICE_ID` only for plans that also have metered recurring Stripe Prices.
- On Vercel, keep `VERCEL_ENV=preview` aligned with `APP_ENV=preview`.
- Run `npm run predeploy` before allowing the build to continue.
- Run `npm run providers:validate` in the preview environment, or run `npm run stripe:validate`, `npm run supabase:validate`, and `npm run jobs:worker:healthcheck` separately when the worker environment is separate from the web shell.
- Deploy the worker separately with `npm run jobs:worker`.
- Run `npm run jobs:worker:healthcheck` after the worker starts.
- For queue validation during preview release checks, `npm run jobs:worker:once` is the safe one-shot verification command.

## Production

- Use `APP_ENV=production`.
- Production provider validation is smoke-only. Follow the safe production checklist in [provider-flow-validation.md](provider-flow-validation.md) and record the result in [readiness-proof-log.md](readiness-proof-log.md).
- Production deployments must use the production application domain and live Supabase project.
- Production deployments must also use live Stripe billing secrets, return URLs, product ids, and licensed base price ids.
- Metered Stripe price ids are optional unless a live plan also has metered recurring pricing.
- `STRIPE_SECRET_KEY` must be `sk_live_`, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` must be `pk_live_` if it is set.
- The predeploy guard rejects mixed Stripe mode config such as test keys in production or preview/local/test catalog IDs paired with a live secret.
- Keep [subscription-gating-and-billing-recovery.md](subscription-gating-and-billing-recovery.md) aligned with deploy behavior whenever billing access or recovery flow changes.
- On Vercel, keep `VERCEL_ENV=production` aligned with `APP_ENV=production`.
- Run `npm run release:verify` before approving a production release.
- Run `npm run providers:validate` in the production environment only when it is configured with production-safe credentials and a worker shell. If the worker is deployed separately, run `npm run jobs:worker:healthcheck` from the worker environment and record both outputs.
- Production builds should use [vercel.json](../vercel.json) so the predeploy guard runs before `next build`.
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
