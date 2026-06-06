# UtopiaTrax Demo Acceptance Contract

## Audit Root Cause

UtopiaTrax already has a strong static manufacturing dataset: 25 classified saving cards, six direct categories, four roles, mixed phases, evidence definitions, alternatives, approvals, finance locks, pending requests, and volume profiles.

The remaining readiness gap was proof, not raw card count:

- Most guarantees were tested against exported seed constants rather than the persisted workspace graph.
- Demo-critical route tests commonly used empty arrays or generic fixtures, so they did not prove UtopiaTrax-like data reaches each route loader.
- There was no read-only command validating memberships, derived open actions, billing access, stored evidence, volume rows, or the showcase card in the actual database.
- Evidence definitions were counted even though downloadable evidence exists only when private Supabase Storage uploads succeed.
- Billing records were seeded, but the demo contract did not distinguish local access-state proof from a real Stripe customer or Portal proof.
- The demo flow did not name a single planned showcase card.

The routes most likely to show demo-damaging empty content are `/open-actions` for a user with no assigned approvals, `/timeline` when volume rows are absent, `/command-center` when analytics or pending queues are empty, `/reports` when dashboard or command-center loaders degrade, and the evidence tab when storage was skipped.

## A. Purpose

UtopiaTrax is the official paid-pilot demo workspace for US manufacturing SMEs. It must show finance-trusted procurement savings governance with realistic data and no empty demo-critical surfaces.

The workspace is synthetic. It must never contain real customer data or depend on production records.

## B. Required Demo Counts

The persisted seed must produce:

- One workspace named `UtopiaTrax` with slug `utopiatrax`.
- Four known demo users with active memberships.
- Exactly six direct procurement categories.
- Exactly 25 saving cards.
- Cards across Proposed, Finance Validated, Implemented, Captured, and Canceled.
- At least 12 private evidence records when storage is available, plus at least 12 static evidence definitions in all environments.
- At least eight cards with alternative supplier or material scenarios.
- At least five pending phase-change requests.
- At least seven pending approval actions derived from those requests.
- At least ten cards with forecast or actual volume rows.
- At least one Finance Validated and finance-locked card.
- At least one canceled card with a cancellation reason.
- Historical approvals and phase history.
- A non-blocking trialing billing/access record.

The required showcase card is `PP Carrier dual-source negotiation`.

## C. Demo Route Contract

### `/dashboard`

- Portfolio savings totals, phase mix, category mix, and forecast context are populated.
- No first-card or empty-portfolio state is visible.

### `/saving-cards`

- All 25 cards are available across mixed categories and phases.
- Owners, suppliers, materials, savings type, and impact type are visible.
- No empty table state is visible.

### `/saving-cards/[id]`

Use `PP Carrier dual-source negotiation`.

- The baseline, negotiated price, annual volume, and calculated savings are clear.
- Private evidence records are visible when storage proof is available.
- A selected alternative supplier/material scenario is visible.
- Approval history, phase history, classification, and captured delivery context are populated.
- Forecast and actual volume rows support the results walkthrough.

### `/kanban`

- Multiple phase columns contain cards.
- Pending requests remain metadata on the current approved phase and do not move cards early.
- No empty-board state is visible.

### `/open-actions`

- The Finance Reviewer login has assigned approval work.
- `/open-actions?view=all` shows the workspace-wide pending queue.

### `/command-center`

- Executive KPIs, pipeline, pending approvals, finance-locked items, risks, filters, and recent decisions are populated.
- No command-center launch state is visible.

### `/timeline`

- Saving-card timing is populated.
- At least ten cards provide forecast or actual volume data for the S-curve.
- No empty timeline or empty S-curve state is visible during the planned route.

### `/reports`

- Executive savings, pending approvals, recent decisions, classification breakdowns, and export controls are populated.
- `/api/export` returns a controller-review workbook.

### `/admin/members`

- Four demo users and their realistic workspace roles are visible.

### `/admin/settings`

- Workspace identity, billing/access summary, and admin activity are populated.

### `/settings/billing`

- Trialing or active access is visible.
- The workspace is not redirected to `/billing-required`.
- Real Stripe Portal behavior is not claimed unless separately provider-proven.

## D. Demo Roles

| Route or purpose | Recommended user |
| --- | --- |
| Dashboard, saving cards, Kanban, reports, admin | Taylan Iscan, Procurement Lead / Owner |
| Open Actions and finance approval queue | Mert Dulger, Finance Reviewer / Admin |
| Category ownership view | Aylin Demir, Category Owner / Member |
| Operational action view | Can Kaya, Buyer / Member |

Use the Owner for the main buyer flow. Switch to the Finance Reviewer only when assigned-action behavior is part of the meeting.

## E. Provider-Dependent Proof

These proof levels must remain separate:

- **Seed/data proof:** Prisma records, static contract, roles, workflow history, alternatives, classification, and volume rows.
- **Route-render proof:** authenticated app pages render populated UtopiaTrax content.
- **Storage proof:** private evidence objects exist and the signed download route succeeds. Static evidence definitions alone are not storage proof.
- **Stripe proof:** Stripe configuration, Checkout, Portal, and webhook behavior require provider validation. A seeded trialing row proves only local billing access behavior.
- **Supabase Auth proof:** all four users can sign in only when Admin Auth synchronization or controlled manual linking has been verified.

Provider caveat:

> Evidence and billing provider flows are not part of this local demo environment. The app behavior is locally verified; provider proof is tracked separately in provider-flow validation.

## F. Manual Staging Proof Checklist

Use an approved non-production environment and capture:

1. `/dashboard` with portfolio totals, phase mix, category mix, and no empty widgets.
2. `/saving-cards` with the populated 25-card register.
3. `/kanban` with multiple populated phase columns and a pending-request marker.
4. `/saving-cards/[showcase-id]` overview with calculation, classification, alternatives, and workflow history.
5. The showcase evidence tab, only after a successful private download check.
6. The showcase results tab with forecast and actual volume.
7. `/open-actions` as the Finance Reviewer.
8. `/open-actions?view=all` as the Owner.
9. `/command-center` with populated approval and risk sections.
10. `/timeline` Gantt view and Volume S-Curve.
11. `/reports` with executive summary and classification breakdowns.
12. A successful `/api/export` workbook download.
13. `/admin/members` with four users.
14. `/admin/settings` with workspace identity, billing card, and activity.
15. `/settings/billing` showing non-blocked access.

Record the environment, timestamp, active user, showcase card ID, export filename, evidence download result, and any provider caveat. Preview or production status requires screenshots from that actual environment.
