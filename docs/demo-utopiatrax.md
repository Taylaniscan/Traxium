# UtopiaTrax Demo Workspace

UtopiaTrax is a polished demo workspace for a 250-person specialty masterbatch and compound manufacturing company. The demo story is:

> Finance-trusted procurement savings tracking for manufacturing SMEs.

Procurement used to track savings in Excel. Traxium now gives procurement and finance one governed savings register with saving cards, evidence, approval status, finance validation, dashboard visibility, timeline tracking, and executive reporting.

## Run The Seed

```bash
npm run db:seed:utopiatrax
```

Reset and recreate only the UtopiaTrax demo workspace:

```bash
npm run db:seed:utopiatrax -- --reset
```

Production-like environments require an explicit confirmation:

```bash
DEMO_SEED_CONFIRM=UtopiaTrax npm run db:seed:utopiatrax
```

The script is idempotent and uses stable natural keys: workspace slug, user emails, master-data names, and saving-card titles. It does not expose a public API endpoint and does not modify unrelated workspaces.

## Demo Users

Password for all demo users:

```text
Traxium123!
```

| Email | Name | Demo role |
| --- | --- | --- |
| taylaniscan+4@gmail.com | Taylan Iscan | Head of Global Procurement / Owner |
| taylaniscan+5@gmail.com | Mert Dulger | Financial Controller / Admin |
| taylaniscan+6@gmail.com | Aylin Demir | Global Category Leader / Member |
| taylaniscan+7@gmail.com | Can Kaya | Tactical Buyer / Operations Stakeholder |

When `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available, the seed creates or updates these Supabase Auth users safely through the Admin API. Supabase stores password hashes outside the application database. The script does not write plaintext passwords to Prisma tables and does not send invitation emails.

If Supabase Admin Auth is unavailable, the script still creates the Prisma workspace, users, and memberships, then prints clear auth-linking instructions.

## What The Demo Shows

The seed creates a realistic manufacturing procurement workspace with:

- 6 direct procurement categories.
- 25 saving cards across Idea, Validated, Realised, Achieved, and Cancelled.
- Manufacturing suppliers, materials, buyers, plants, and business units.
- Private evidence records for the cards when Supabase Storage is available.
- Alternative supplier/material scenarios for benchmark and dual-source demos.
- Historical phase changes, approvals, audit events, finance locks, and pending approval actions.
- Forecast and actual volume rows for S-curve and timeline demos.
- Trialing billing/access records so UtopiaTrax is not blocked by billing gates.

Use it to demo:

- Dashboard
- Saving Cards
- Kanban
- Timeline
- Reports
- Command Center
- Open Actions
- Admin Members
- Workspace Settings
- Onboarding Readiness
- Evidence and finance trust
- Alternative suppliers/materials
- Approvals and finance lock
- Billing/access readiness
