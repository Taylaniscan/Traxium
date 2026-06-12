# Paid Pilot Offer And Pricing Hypothesis

This document defines Traxium's current commercial next step after a buyer demo. It is intentionally sales-led: use it to align the buyer, founder/operator, and implementation owner before activating Stripe billing.

## Buyer Fit

Best-fit first pilot:

- 50-500 employee US manufacturing SME.
- Procurement and finance both care about a trusted savings register.
- The team has recurring direct or indirect savings work, but current tracking lives in spreadsheets, email, or slide decks.
- The buyer can name one procurement owner, one finance reviewer, and one admin or security contact.
- The team is willing to validate one governed workspace before discussing a broader rollout.

Not a good first-pilot fit:

- Buyer requires SSO/SAML, ERP/MRP integration, vendor risk scoring, contract lifecycle management, public compliance certification, custom BI feeds, or 24/7 support before any pilot.
- Buyer needs a self-serve public pricing page or automated seat management before talking to the team.
- Buyer wants custom approval-builder logic instead of the implemented phase-change approval workflow.

## Offer Shape

Pilot duration:

- 30-45 days.
- One manufacturing workspace.
- One focused working group across procurement, finance, and administration.

Included:

- Kickoff session to confirm categories, plants, buyers, finance reviewers, first saving cards, evidence expectations, and success criteria.
- UtopiaTrax walkthrough before live data entry.
- Guided creation of the first real saving card.
- Guided use of savings type, impact type, recurrence, and budget-impact classification with safe defaults.
- Inline master-data setup for buyers, suppliers, materials, categories, plants, and business units when setup is incomplete.
- Review of the canonical workflow: Proposed, Finance Validated, Implemented, Captured, and Canceled.
- At least one phase-change request reviewed through the approval flow.
- Evidence-handling review when private Supabase Storage is configured.
- Weekly operating review covering open actions, finance locks, dashboard movement, reporting, and export fit.
- Controller-ready workbook setup with Portfolio Summary, Saving Cards, Data Dictionary, Import Template, and Evidence Summary sheets.
- End-of-pilot recap with decision summary, blockers, rollout recommendation, and reconciled export handoff.

Excluded from the first paid pilot:

- SSO/SAML.
- ERP or MRP connectors.
- Custom approval-builder configuration.
- Contract lifecycle management.
- Vendor risk scoring.
- Broad spend analytics.
- Custom BI or data warehouse feeds.
- Custom workbook layouts per buyer.
- Direct finance-system posting.
- Accounting-recognition calculations, audited-result claims, GAAP treatment, or ERP actual matching.
- 24/7 support.
- Public compliance certification claims.

## Success Criteria

The pilot should be judged on product fit and buyer trust, not vanity usage.

Minimum success criteria:

- The team creates real saving cards without leaving the first-card flow for missing master data.
- Procurement and finance can see the same active portfolio in Dashboard, Kanban, Timeline, Command Center, Reports, and Open Actions.
- At least one phase-change request is reviewed through the implemented approval flow.
- Finance can inspect assumptions, evidence, finance-lock state, and decision history.
- Finance can distinguish hard savings, cost avoidance, recurring impact, one-time benefits, and budget-impacting initiatives in reports and export.
- Admins can explain workspace membership, role coverage, billing posture, and evidence-storage boundaries.
- The buyer can export a controller-review XLSX workbook and explain what is included and excluded.
- The end-of-pilot recap produces a clear continue, expand, pause, or stop recommendation.

Failure signals:

- Finance still does not trust the savings numbers after seeing evidence, assumptions, and approvals.
- The team cannot create or update saving cards without heavy custom support.
- The buyer's required trust controls depend on excluded capabilities.
- Dashboard, Kanban, and export views do not agree after refresh.

## Support Model

Pilot support should be explicit before kickoff.

- Business-hours support during the pilot.
- One kickoff, weekly operating reviews, and one end-of-pilot recap.
- Same-business-day attention for login, billing access, blocked workspace, evidence download, or export failures.
- Next-business-day target for workflow, reporting, import, master-data, and UX questions.
- Product fixes are prioritized by pilot impact.
- Custom development is out of scope unless separately agreed after pilot learning.

The buyer-facing support contract is [support-expectations.md](support-expectations.md). It defines business-hours, email-based support, best-effort same-business-day critical attention, a one-business-day normal response target, provider-outage handling, and the no-enterprise-SLA boundary.

Buyer responsibilities:

- Assign one procurement owner, one finance reviewer, and one admin/security contact.
- Provide enough sample or live saving-card data to test finance-trusted workflow.
- Provide the current Excel savings tracker with buyer/supplier/material/category names, baseline and new prices, annual volume, currency, and impact dates.
- Correct any row-level validation errors before the controlled all-or-nothing import is committed.
- Decide whether private evidence storage is in scope for the pilot environment.
- Participate in weekly review and end-of-pilot decision.

Before live data entry, use [paid-pilot-security-review-checklist.md](paid-pilot-security-review-checklist.md) to agree users, roles, evidence scope, provider proof, billing ownership, support contacts, export, backup assumptions, and offboarding limitations.

## Pricing Hypothesis

This is a working hypothesis, not a public pricing page.

Commercial stance:

- Sell the first package as a guided paid pilot, not self-serve software access.
- Use fixed pilot pricing and one Stripe subscription plan once the buyer chooses a paid path.
- Do not publish seat, card, upload, API, or metered-usage limits until plan metadata and billing copy are finalized together.
- Keep the first invoice simple: one product, one base recurring Price, monthly billing, no metered usage unless the live Stripe catalog and support process are intentionally expanded.

Hypothesis for first buyer conversations:

| Offer | Suggested positioning | Internal price hypothesis | Stripe plan relation |
|---|---|---:|---|
| Starter Pilot | One workspace, one focused procurement/finance team, prove governed saving-card workflow and export fit. | USD 4,500-7,500 for the pilot period | Map to `starter` after the buyer chooses a paid path. |
| Growth Pilot | One workspace with broader stakeholder coverage, more categories/plants, tighter executive review, and rollout planning. | USD 9,000-15,000 for the pilot period | Map to `growth` after the buyer chooses a paid path. |

Pricing should flex based on:

- Data-entry and onboarding assistance required.
- Number of stakeholder groups involved in weekly review.
- Evidence-storage/security review depth.
- Whether the pilot needs Stripe Checkout/Portal proof before kickoff.
- Whether the buyer expects rollout planning beyond the end-of-pilot recap.

Pricing should not flex based on unimplemented mechanics:

- Seat-based self-serve provisioning.
- Card-count automation.
- Upload-volume metering.
- Public API usage.
- Custom per-module entitlements.

## Stripe Plan Relationship

The current billing code exposes exactly two plan codes: `starter` and `growth`.

- `lib/billing/config.ts` requires Stripe Product and base Price IDs for `starter` and `growth`.
- `app/settings/billing/page.tsx` renders `Starter` and `Growth` plan choices for admins when checkout or subscription setup is appropriate.
- Metered Stripe Price IDs are optional and should stay unset unless the plan really uses metered recurring pricing.
- The billing access layer supports active, trialing, grace-period, blocked, and missing-subscription states; it does not publish plan limits or enforce public pricing tiers.

Recommended use:

- Use `starter` for the standard first paid pilot.
- Use `growth` when the pilot has broader rollout ambition or materially more guided support.
- Use `Request paid pilot` as the public homepage CTA and route qualified buyers to `/pilot`.
- Keep `/request-demo` as a compatibility redirect to the same founder-led pilot request.
- Treat lead submission as a fit-review request. Do not create a user, workspace, free trial, or Stripe subscription automatically.
- Use `/trust` and [trust-pack.md](trust-pack.md) for the factual paid-pilot trust story.
- Keep data export/offboarding and backup/restore limitations aligned with [data-export-offboarding.md](data-export-offboarding.md) and [backup-restore-statement.md](backup-restore-statement.md).
- Treat Stripe Checkout and Portal as billing handoff infrastructure, not as proof that pricing is self-serve.

## Decision Path After Pilot

End the pilot with one of four recommendations:

- Continue: keep the same workspace active on the chosen plan.
- Expand: move from Starter-style pilot scope to Growth-style rollout planning.
- Pause: export the workbook, document blockers, and wait for a trust or operational prerequisite.
- Stop: export the workbook, document why Traxium is not a fit, and close billing cleanly.

The end-of-pilot handoff should include:

- Controller-review XLSX export.
- Summary of real saving cards created and reviewed.
- Approval and finance-lock evidence.
- Trust/support blockers.
- Recommendation for Starter, Growth, or no rollout.
