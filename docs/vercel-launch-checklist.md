# Vercel Launch Checklist

The first production launch on Vercel. Code-side guards (predeploy check, pending-migration check, cron authentication) fail the build when something below is missing, but the provider dashboards must be configured by hand. Detailed procedures live in [deployment-strategy.md](deployment-strategy.md), [environment-setup.md](environment-setup.md), [supabase-provider-validation.md](supabase-provider-validation.md), and [stripe-provider-validation.md](stripe-provider-validation.md).

## 1. Blockers (launch cannot proceed without these)

- [ ] **Legal pages.** Publish a Privacy Policy and Terms of Service and link them from the homepage footer, `/pilot`, and login. The pilot form collects personal data from visitors worldwide (including the EU), and Stripe requires these pages before activating live payments. They need the legal entity name, address, governing law, and subprocessors (Vercel, Supabase, Stripe, Sentry, Resend).
- [ ] **Vercel Pro plan.** The Hobby plan is non-commercial and only allows daily crons; `vercel.json` runs the job cron every 5 minutes, and the deploy is rejected on Hobby.
- [ ] **Custom SMTP for Supabase Auth.** Supabase's built-in email sender only delivers to your own project team's addresses and is heavily rate-limited, so customer invitations and password resets will not arrive. Configure custom SMTP in Supabase → Authentication → Emails (Resend provides SMTP credentials) with a sender on your verified domain.
- [ ] **Separate production Supabase project** (never the development project). Create it in `eu-central-1` to match `vercel.json` `regions: ["fra1"]`, or change `regions` to match.
- [ ] **Merge the release branch into `main`.** Vercel deploys production from the default branch.

## 2. Production Supabase

- [ ] Run `npm run release:migrate` against the production database (with production `DATABASE_URL`/`DIRECT_URL` in the shell). The Vercel build fails while any migration is pending.
- [ ] Auth → URL Configuration: Site URL = `NEXT_PUBLIC_APP_URL`; redirect URLs include `/invite/*`, `/reset-password`, `/auth/bootstrap` on the production domain.
- [ ] Storage: create the private `evidence-private` bucket (or `SUPABASE_STORAGE_BUCKET`). Optionally set its file size limit to 25 MB as defense in depth; the app also verifies size after each upload.
- [ ] Enable backups / point-in-time recovery per [backup-restore-statement.md](backup-restore-statement.md).

## 3. Vercel project environment (Production)

Set for the **Production** environment (preview gets its own non-production values):

- [ ] `APP_ENV=production`, `NEXT_PUBLIC_APP_URL=https://<production domain>` (must equal the project's production domain).
- [ ] `DATABASE_URL` — Supabase transaction pooler (port 6543) with `pgbouncer=true&connection_limit=1&sslmode=require`. `DIRECT_URL` — session pooler (5432) with `sslmode=require&connect_timeout=30`.
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (production project).
- [ ] `JOB_RUNNER_SECRET` and `CRON_SECRET` (random, at least 32 characters each).
- [ ] Stripe live values: `STRIPE_SECRET_KEY` (`sk_live_`), `STRIPE_WEBHOOK_SECRET`, return/success/cancel URLs, live product and price ids.
- [ ] `PILOT_LEAD_HASH_SECRET`; `RESEND_API_KEY`, `PILOT_LEAD_NOTIFICATION_EMAIL`, `PILOT_LEAD_NOTIFICATION_FROM` (verified domain sender).
- [ ] Optional: `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`, analytics keys.
- [ ] Add the custom domain in Vercel before the first production deploy (the predeploy check compares it to `NEXT_PUBLIC_APP_URL`).

## 4. Stripe (live mode)

- [ ] Webhook endpoint `https://<production domain>/api/billing/webhook` subscribed to `checkout.session.completed`, `customer.created`, `customer.updated`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
- [ ] Customer portal configured; business details, terms, and privacy URLs filled in.

## 5. After the first deploy

- [ ] Run the checks in [post-release-smoke-tests.md](post-release-smoke-tests.md).
- [ ] Admin → Job Health shows a recent heartbeat within 10 minutes (proves the cron authenticates).
- [ ] Send a test invitation and a password reset to an outside address and confirm delivery.
- [ ] Upload a 10 MB PDF as evidence and download it (exercises the signed direct-to-storage upload).
- [ ] Submit the `/pilot` form and confirm the notification email arrives.
- [ ] `https://<domain>/robots.txt` lists the sitemap; a preview URL's `robots.txt` disallows everything.
