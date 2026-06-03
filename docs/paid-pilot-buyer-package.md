# Paid Pilot Buyer Package

This package defines the first buyer experience for Traxium as of the commercial-readiness workstream. It is intentionally narrow: help a 50-500 employee US manufacturing SME prove finance-trusted procurement savings governance with the product that exists today.

## Landing Page Promise

Primary promise:

> Finance-trusted savings governance for US manufacturing SMEs.

Supporting story:

- Traxium gives procurement and finance one governed savings register for saving cards, evidence, approvals, open actions, portfolio views, and controller-ready export.
- The first pilot is for one manufacturing workspace, one focused team, and real saving-card workflow.
- The product should sell governed savings work, not broad procurement-suite replacement.

Primary calls to action:

- `Sign in` for existing pilot users.
- `View product` for internal/demo access until a public request-demo workflow exists.

Proof points the page may safely claim:

- Saving cards with buyers, suppliers, materials, plants, categories, business units, commercial assumptions, and impact windows.
- Canonical phases: Idea, Validated, Realized, Achieved, and Canceled.
- Phase-change approval requests, open actions, workflow audit history, and finance lock behavior.
- Private evidence records with signed download routes when Supabase Storage is configured.
- Dashboard, Kanban, Timeline, Command Center, Reports, Open Actions, Admin, and billing-access readiness surfaces.
- XLSX export with portfolio summary, active saving cards, phase counts, realized and achieved value, finance locks, and row-level savings assumptions.

Claims that require more proof before public use:

- Production provider validation for Supabase Auth redirects, private storage, signed URLs, and service-role boundaries.
- Production Stripe Checkout, Portal, webhook, and billing recovery proof.
- Published security or compliance claims beyond the implemented tenant isolation, RBAC, private storage, audit, and environment checks.

## Paid Pilot Offer

Detailed commercial terms live in [paid-pilot-offer-and-pricing.md](/Users/atlas/Documents/Traxium/docs/paid-pilot-offer-and-pricing.md). This section keeps the buyer-package summary aligned with that source.

Pilot shape:

- 30-45 day guided paid pilot for one manufacturing workspace.
- One kickoff session to confirm categories, plants, buyers, finance reviewers, and the first savings cases.
- UtopiaTrax demo walkthrough before live data entry, so the buyer sees the intended operating model.
- Guided creation of the first real saving card, including inline master-data creation when setup is incomplete.
- Approval workflow review with Procurement Lead and Finance Reviewer coverage.
- Evidence-handling review with the buyer's security or IT contact when storage is configured.
- Weekly review of open actions, finance locks, dashboard movement, and reporting/export fit.
- End-of-pilot recap with success criteria, blockers, recommended rollout path, and export handoff.

Commercial hypothesis:

- Use the existing Starter or Growth Stripe plan plumbing only after the buyer chooses a paid path.
- Treat the first commercial package as a sales-led paid pilot, not a self-serve pricing page.
- Use fixed pilot pricing as a hypothesis before publishing any self-serve pricing.
- Do not publish seat, card, upload, or API limits until plan metadata and billing copy are finalized together.

Pilot success criteria:

- The team creates real saving cards without leaving the first-card flow for missing master data.
- Procurement and finance can see the same active portfolio in dashboard, Kanban, Timeline, Command Center, Reports, and Open Actions.
- At least one phase-change request is reviewed through the approval flow.
- Finance can inspect commercial assumptions, evidence, and finance-lock status.
- The buyer can export a controller-review workbook and understand what is and is not included.
- Admins can explain workspace membership, role coverage, billing state, and evidence storage boundaries.

## Demo Script

Use UtopiaTrax as the buyer-facing proof workspace.

1. Start with the buyer problem: Excel savings registers lose ownership, evidence, approval state, and finance trust.
2. Open `/dashboard` and show the portfolio story: total savings, phase mix, category view, recent activity, and no empty-state gaps.
3. Open `/kanban` and show governed movement: pending phase-change requests stay in their current columns until approval completes.
4. Open a saving-card detail and show commercial assumptions, alternative supplier/material scenarios, evidence, phase history, and finance lock status.
5. Open `/open-actions` and show the assigned approval queue for a Procurement Lead or Finance Reviewer.
6. Open `/command-center` and show executive queue, finance validation, recent decisions, and filters by buyer, category, supplier, plant, and business unit.
7. Open `/timeline` and show forecast/actual volume context for implementation timing.
8. Open `/reports` and explain the executive summary and XLSX export workbook.
9. Open `/admin/settings` or `/admin/members` for the IT/security reviewer and show workspace boundaries, members, role coverage, and billing posture.
10. Close with the pilot offer: one workspace, real saving cards, weekly operating review, support expectations, export handoff, and a rollout recommendation.

Persona emphasis:

- CFO: realized and achieved value, finance locks, evidence, export, and decision history.
- Procurement Lead: ownership, phase discipline, open actions, category/supplier view, and first-card speed.
- Finance Reviewer: assumptions, approval queue, finance lock rules, and controller-ready export.
- IT/security reviewer: tenant isolation, private evidence storage path, auth redirects, signed downloads, billing access, and provider-proof gaps.

Provider fallback:

- If Supabase Auth or Storage is unavailable in the demo environment, say so directly and avoid claiming provider proof.
- If Stripe Checkout, Portal, or webhook proof is unavailable, keep the billing story to configured access states and recovery routes.

## Security And Trust Page Needs

A public trust page should not be published until provider-flow validation is recorded. The page needs plain-language coverage for:

- Workspace-based tenant isolation and active-organization scoping.
- Membership roles, business roles, and approval coverage.
- Private evidence bucket requirements and signed download routes.
- Audit events for workflow, admin, import/export, and evidence activity.
- Supabase Auth redirect behavior for login, invites, and password recovery.
- Stripe billing mode separation, Checkout, Portal, webhook, and recovery behavior.
- Rate limiting, quota checks, file type limits, and export handling.
- Incident/support contact path and expected response posture.

Do not claim SOC 2 certification, 24/7 support, SSO/SAML, ERP integration, custom approval builders, vendor risk scoring, contract lifecycle management, or spend analytics until those capabilities exist and are validated.

## Support Expectations

Paid-pilot support should be explicit:

- Business-hours support during the pilot.
- One kickoff, weekly operating reviews, and an end-of-pilot recap.
- Same-business-day attention for login, billing access, blocked workspace, evidence download, or export failures.
- Next-business-day target for workflow, reporting, import, master-data, and UX questions.
- Product fixes are prioritized by pilot impact; custom development is out of scope for the first pilot.
- The buyer should provide one procurement owner, one finance reviewer, and one admin/security contact.

## Data Export Expectations

The current export expectation is a controller-review XLSX workbook, not a full data warehouse or ERP sync.

Export includes:

- Portfolio summary sheet with reporting basis, active cards, savings totals, realized/achieved value, finance locks, coverage, last update, and phase counts.
- Saving-card rows with controller-friendly headers, commercial assumptions, phases, ownership, category/supplier/material context, finance-lock status, and fallback relation names.

Import expectations:

- Saving-card import validates all rows before write. If any row fails, no saving cards are imported and row errors are shown.
- Master-data import supports buyers, suppliers, materials, and categories from CSV or XLSX.
- Plant and business-unit setup should use onboarding/manual entry or inline first-card creation until bulk upload is connected.

Not included in the first export/import promise:

- ERP sync.
- Public API data extraction.
- Custom workbook layouts per buyer.
- Direct finance-system posting.
- Historical deleted-record archive exports.

## First-Pilot Exclusions

The first paid pilot should explicitly exclude:

- SSO/SAML.
- ERP or MRP connectors.
- Custom approval-builder configuration.
- Contract lifecycle management.
- Vendor risk scoring.
- Broad spend analytics.
- Custom BI/data warehouse feeds.
- 24/7 support.
- Public compliance certification claims.
