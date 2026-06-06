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

Validate the persisted workspace without changing data:

```bash
npm run demo:utopiatrax:validate
```

The validator checks the workspace graph, users and memberships, categories, saving cards, phase mix, private evidence metadata, alternatives, pending approvals, workflow history, finance locks, volume rows, billing access, admin activity, and the recommended showcase card. It prints provider warnings separately because a database row is not proof of a Supabase login, signed evidence download, or Stripe Portal session.

Generate the exact controller-review workbook through the same renderer used by `/api/export`:

```bash
npm run demo:utopiatrax:export
```

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
| taylaniscan+7@gmail.com | Can Kaya | Buyer / Operations Stakeholder |

When `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available, the seed creates or updates these Supabase Auth users safely through the Admin API. Supabase stores password hashes outside the application database. The script does not write plaintext passwords to Prisma tables and does not send invitation emails.

If Supabase Admin Auth is unavailable, the script still creates the Prisma workspace, users, and memberships, then prints clear auth-linking instructions.

## What The Demo Shows

The seed creates a realistic manufacturing procurement workspace with:

- 6 direct procurement categories.
- 25 saving cards across Proposed, Finance Validated, Implemented, Captured, and Canceled.
- Controlled savings classification on every card: savings type, impact type, recurrence, and budget impact.
- Manufacturing suppliers, materials, buyers, plants, and business units.
- Typed private PDF evidence records for the cards when Supabase Storage is available.
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

The classification mix is intentionally varied for finance review and report demos. It includes price reductions, supplier switches, rebates/credits, specification changes, volume consolidation, freight/logistics, payment terms, process/tolling, and cost avoidance. Impact examples include hard savings, cost avoidance, working-capital impact, recurring value, one-time or temporary value, budget impact, forecast avoidance, and non-budget operational benefit.

Classification improves review quality; it does not claim accounting recognition, audited results, ERP actual matching, or GAAP treatment.

## Paid Pilot Demo Flow

Use this workspace with the [paid pilot buyer package](/Users/atlas/Documents/Traxium/docs/paid-pilot-buyer-package.md). The short buyer-meeting path is:

1. Start on `/dashboard` with the finance-trusted portfolio story.
2. Move to `/kanban` to show that pending approval work stays governed instead of jumping phases early.
3. Open one saving-card detail to inspect assumptions, alternatives, evidence, approval history, and finance lock status.
4. Open `/open-actions` as a Procurement Lead or Finance Reviewer to show the real approval queue.
5. Open `/command-center` and `/timeline` for executive queue, filter, and implementation timing proof.
6. Open `/reports` and export the controller-review workbook. Point out Portfolio Summary, Saving Cards, Data Dictionary, Import Template, and Evidence Summary.
7. Close on `/admin/settings`, `/admin/members`, or billing settings for workspace, role, trust, and access boundaries.

If Supabase Auth, Supabase Storage, or Stripe provider flows are unavailable in the demo environment, call that out during the meeting and keep the proof to the locally verified app behavior.

## Recommended Showcase Card

Use **PP Carrier dual-source negotiation** after the Dashboard and Kanban.

Why this card:

- It is a captured, high-value manufacturing initiative with a clear price and volume case.
- It has five evidence definitions and private stored evidence when Supabase Storage is available.
- It includes a selected alternative supplier and material scenario.
- It has procurement and finance approval history plus phase history.
- It has forecast and confirmed actual volume rows.
- Its `Supplier Switch`, `Hard Savings`, `Recurring`, and `Budget Impact` classification is easy to explain.

Point out:

1. Baseline price, negotiated price, annual volume, and calculated savings.
2. The finance-facing savings classification.
3. Borealis as the baseline supplier and Sabic as the qualified benchmark/backup.
4. Supplier quote, price confirmation, calculation workbook, implementation proof, negotiation summary, and their signed app download routes.
5. Approval decisions and captured phase history.
6. Forecast versus actual volume in Results.
7. The distinction between a captured card and Finance Validated cards that remain finance locked.

The validator prints the current database ID so the route can be opened directly:

```text
/saving-cards/<showcase-card-id>
```

## 3-Minute Outcome Demo

1. **Dashboard:** “Here is the finance-trusted portfolio: total savings, phase mix, category exposure, finance controls, and delivery outlook.”
2. **Kanban:** “Here is governed phase discipline. Pending requests stay on the approved phase until the required people decide.”
3. **Showcase card:** “Here are the commercial assumptions, savings classification, evidence, alternative source, finance review, and delivery history behind one number.”
4. **Open Actions:** “Here is what procurement and finance need to decide next.”
5. **Reports:** “Here is the controller review view and the reconciled five-sheet workbook export.”

## 10-Minute All-Feature Demo

1. `/dashboard` — portfolio value, phase mix, category mix, target/forecast context.
2. `/saving-cards` — 25-card governed register with owners, suppliers, materials, phases, and classifications.
3. `/kanban` — multiple populated phases and pending-request metadata.
4. `/saving-cards/<showcase-card-id>` — assumptions, alternatives, evidence, history, and results.
5. `/open-actions` as Finance Reviewer — assigned approvals.
6. `/open-actions?view=all` as Owner — workspace-wide queue.
7. `/command-center` — executive approvals, overdue work, locked cases, risks, and recent decisions.
8. `/timeline` — implementation timing, then Volume S-Curve.
9. `/reports` — executive summary, classification breakdown, evidence coverage, and the five-sheet controller-review export.
10. `/admin/members` — four realistic roles.
11. `/admin/settings` — workspace identity, billing posture, and activity.
12. `/settings/billing` — non-blocking access state only when billing is useful to the conversation.

## Screens Not To Show If Incomplete

- Admin jobs or raw provider diagnostics.
- Empty settings or setup pages.
- Raw logs, stack traces, database IDs, or technical seed output.
- Evidence links until a private signed download has been manually proven.
- Billing actions when Stripe is not configured or Portal/Checkout has not been provider-proven.
- Any card other than the showcase card unless its missing evidence or volume history is intentional to the story.

## Provider Caveat Language

When Supabase Storage or Stripe provider flows are unavailable, say:

> Evidence and billing provider flows are not part of this local demo environment. The app behavior is locally verified; provider proof is tracked separately in provider-flow validation.

Do not imply that evidence was downloaded, Stripe Portal was opened, or all four users signed in unless those actions were completed in the current environment.

## Paid-Pilot Screenshot Checklist

Capture:

1. Dashboard portfolio summary.
2. Dashboard phase and category mix.
3. Saving Cards register with mixed phases.
4. Kanban with multiple populated columns.
5. Showcase card financial case and classification.
6. Showcase alternatives and approval history.
7. Showcase evidence list after download proof.
8. Showcase Results forecast/actual view.
9. Finance Reviewer Open Actions.
10. Command Center pending approvals and finance-locked work.
11. Timeline Gantt.
12. Volume S-Curve.
13. Reports executive summary, classification breakdown, and evidence coverage.
14. Export workbook Portfolio Summary and Saving Cards sheets with the zero-difference reconciliation check.
15. Admin Members with four users.
16. Workspace Settings with billing card and activity.
17. Billing status, only when the environment is non-blocked and presentation-ready.

## Staging Validation Checklist

Run only against an approved non-production database:

```bash
npm run db:seed:utopiatrax -- --reset
```

Then verify:

- `npm run demo:utopiatrax:validate` passes.
- Seed summary reports 25 saving cards, 6 direct categories, 5 pending phase-change requests, 7 pending open actions, forecast rows, actual rows, alternatives, and trialing billing access.
- `/dashboard` shows populated savings, phase, category, and forecast widgets for UtopiaTrax.
- `/saving-cards` shows all 25 manufacturing initiatives with evidence, alternatives, finance locks, and mixed phases.
- `/kanban`, `/timeline`, and `/command-center` show the same portfolio story without empty-state messaging.
- `/open-actions` shows assigned approvals for the active demo user, and `/open-actions?view=all` shows the workspace-wide pending queue.
- `/reports` shows executive savings context, pending approval indicators, and recent workflow decisions.
- `/reports` shows savings by savings type, impact type, recurrence, and budget impact, and the workbook includes the same customer-facing columns.
- `/reports` shows evidence coverage and finance-stage gaps; the workbook includes evidence count, status, types, and last-upload date without URLs or storage paths.
- The UtopiaTrax workbook contains 25 Saving Cards rows, all six direct categories, evidence coverage, finance locks, pending approval status, a Data Dictionary, and an Import Template.
- The presenter should open `Portfolio Summary` first, confirm `Reconciliation Difference (EUR)` is zero, then filter `Saving Cards` by phase, finance lock, evidence status, category, and buyer.
- Import proof should use a separate test workbook. Traxium validates all rows, shows field/value/fix errors, creates no cards when any row fails, and commits successful saving-card imports in one transaction.
- `/admin/settings` and `/admin/insights` show workspace-scoped activity, including workflow decisions.
- `/settings/billing` does not block UtopiaTrax because the seed creates trialing billing/access records.

When storage service-role access is configured, verify evidence downloads through the app route rather than public storage URLs. If storage is skipped, rerun the seed after configuring Supabase Storage before using evidence downloads in a buyer demo.
