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
| taylaniscan+4@gmail.com | Taylan Iscan | Procurement Lead / Owner |
| taylaniscan+5@gmail.com | Mert Dulger | Finance Reviewer / Admin |
| taylaniscan+6@gmail.com | Aylin Demir | Category Owner / Member |
| taylaniscan+7@gmail.com | Can Kaya | Tactical Buyer / Operations Stakeholder |

When `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available, the seed creates or updates these Supabase Auth users safely through the Admin API. Supabase stores password hashes outside the application database. The script does not write plaintext passwords to Prisma tables and does not send invitation emails.

If Supabase Admin Auth is unavailable, the script still creates the Prisma workspace, users, and memberships, then prints clear auth-linking instructions.

## What The Demo Shows

The seed creates a realistic manufacturing procurement workspace with:

- 6 direct procurement categories.
- 25 saving cards across Idea, Validated, Realized, Achieved, and Canceled.
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

## Paid Pilot Demo Flow

Use this workspace with the [paid pilot buyer package](/Users/atlas/Documents/Traxium/docs/paid-pilot-buyer-package.md). The short buyer-meeting path is:

1. Start on `/dashboard` with the finance-trusted portfolio story.
2. Move to `/kanban` to show that pending approval work stays governed instead of jumping phases early.
3. Open one saving-card detail to inspect assumptions, alternatives, evidence, approval history, and finance lock status.
4. Open `/open-actions` as a Procurement Lead or Finance Reviewer to show the real approval queue.
5. Open `/command-center` and `/timeline` for executive queue, filter, and implementation timing proof.
6. Open `/reports` and export the controller-review workbook.
7. Close on `/admin/settings`, `/admin/members`, or billing settings for workspace, role, trust, and access boundaries.

If Supabase Auth, Supabase Storage, or Stripe provider flows are unavailable in the demo environment, call that out during the meeting and keep the proof to the locally verified app behavior.

## Staging Validation Checklist

Run only against an approved non-production database:

```bash
npm run db:seed:utopiatrax -- --reset
```

Then verify:

- Seed summary reports 25 saving cards, 6 direct categories, 5 pending phase-change requests, 7 pending open actions, forecast rows, actual rows, alternatives, and trialing billing access.
- `/dashboard` shows populated savings, phase, category, and forecast widgets for UtopiaTrax.
- `/saving-cards` shows all 25 manufacturing initiatives with evidence, alternatives, finance locks, and mixed phases.
- `/kanban`, `/timeline`, and `/command-center` show the same portfolio story without empty-state messaging.
- `/open-actions` shows assigned approvals for the active demo user, and `/open-actions?view=all` shows the workspace-wide pending queue.
- `/reports` shows executive savings context, pending approval indicators, and recent workflow decisions.
- `/admin/settings` and `/admin/insights` show workspace-scoped activity, including workflow decisions.
- `/settings/billing` does not block UtopiaTrax because the seed creates trialing billing/access records.

When storage service-role access is configured, verify evidence downloads through the app route rather than public storage URLs. If storage is skipped, rerun the seed after configuring Supabase Storage before using evidence downloads in a buyer demo.
