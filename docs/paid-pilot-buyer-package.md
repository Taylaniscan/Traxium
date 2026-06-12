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

- `Request paid pilot` for qualified prospective buyers at `/pilot`.
- `See UtopiaTrax demo` for the public demo preview and guided-demo context.
- `Trust & security` for the buyer-readable paid-pilot trust boundary at `/trust`.
- `Sign in` for existing pilot users.

The public pilot form captures buyer identity, company, role, company size, industry, current savings-tracking method, reporting pain, tracker availability, and timeline. It validates and rate-limits submissions, uses a honeypot, stores the lead without creating a user or workspace, and suppresses recent duplicate requests.

Lead review is currently manual. The existing email-job system is limited to authentication delivery, so the public form does not claim that an internal notification email was sent.

Proof points the page may safely claim:

- Saving cards with buyers, suppliers, materials, plants, categories, business units, commercial assumptions, and impact windows.
- Controlled classification that distinguishes savings type, hard savings versus cost avoidance, recurrence, and budget treatment.
- Canonical phases: Proposed, Finance Validated, Implemented, Captured, and Canceled.
- Phase-change approval requests, open actions, workflow audit history, and finance lock behavior.
- Private evidence records with signed download routes when Supabase Storage is configured.
- Evidence types, card-level evidence status, portfolio coverage, and controller-export metadata without exposing private storage paths.
- Dashboard, Kanban, Timeline, Command Center, Reports, Open Actions, Admin, and billing-access readiness surfaces.
- XLSX export with portfolio summary, active saving cards, phase counts, implemented and captured value, finance locks, and row-level savings assumptions.
- Controller-review reporting and export breakdowns by savings type, impact type, recurrence, and budget impact.

Claims that require more proof before public use:

- Production provider validation for Supabase Auth redirects, private storage, signed URLs, and service-role boundaries, recorded through [provider-flow-validation.md](provider-flow-validation.md).
- Production Stripe Checkout, Portal, webhook, and billing recovery proof, recorded through [provider-flow-validation.md](provider-flow-validation.md).
- Published security or compliance claims beyond the implemented tenant isolation, RBAC, private storage, audit, and environment checks.

The public request flow does not accept savings tracker attachments. Tracker review happens later through an agreed secure pilot process.

## Paid Pilot Offer

Detailed commercial terms live in [paid-pilot-offer-and-pricing.md](paid-pilot-offer-and-pricing.md). This section keeps the buyer-package summary aligned with that source.

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
- Finance can identify validated, implemented, or captured cards that are missing supporting evidence.
- Finance can distinguish hard savings, cost avoidance, recurring impact, one-time benefits, and budget-impacting initiatives.
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

- CFO: implemented and captured value, finance locks, evidence, export, and decision history.
- Procurement Lead: ownership, phase discipline, open actions, category/supplier view, and first-card speed.
- Finance Reviewer: assumptions, approval queue, finance lock rules, and controller-ready export.
- IT/security reviewer: tenant isolation, private evidence storage path, auth redirects, signed downloads, billing access, and provider-proof gaps.

Provider fallback:

- If Supabase Auth or Storage is unavailable in the demo environment, say so directly and avoid claiming provider proof.
- If Stripe Checkout, Portal, or webhook proof is unavailable, keep the billing story to configured access states and recovery routes.

## Security And Trust Page Needs

The public `/trust` page provides plain-language paid-pilot coverage for:

- Workspace-based tenant isolation and active-organization scoping.
- Membership roles, business roles, and approval coverage.
- Private evidence bucket requirements and signed download routes.
- Audit events for workflow, admin, import/export, and evidence activity.
- Supabase Auth redirect behavior for login, invites, and password recovery.
- Stripe billing mode separation, Checkout, Portal, webhook, and recovery behavior.
- Rate limiting, quota checks, file type limits, and export handling.
- Incident/support contact path and expected response posture.

The page must remain explicit that local tests and provider scripts do not equal a complete preview or production provider pass. Environment-specific proof is tracked through [provider-flow-validation.md](provider-flow-validation.md) and [readiness-proof-log.md](readiness-proof-log.md).

The buyer-shareable package includes:

- [trust-pack.md](trust-pack.md)
- [support-expectations.md](support-expectations.md)
- [data-export-offboarding.md](data-export-offboarding.md)
- [backup-restore-statement.md](backup-restore-statement.md)
- [paid-pilot-security-review-checklist.md](paid-pilot-security-review-checklist.md)
- [evidence-trust-contract.md](evidence-trust-contract.md)

Do not claim SOC 2 certification, ISO 27001 certification, HIPAA compliance, 24/7 support, SSO/SAML, SCIM, ERP integration, accounting posting, custom approval builders, vendor risk scoring, contract lifecycle management, broad spend analytics, an enterprise SLA, or audited accounting recognition.

## Support Expectations

Paid-pilot support should be explicit:

- Business-hours support during the pilot.
- One kickoff, weekly operating reviews, and an end-of-pilot recap.
- Same-business-day attention for login, billing access, blocked workspace, evidence download, or export failures.
- Next-business-day target for workflow, reporting, import, master-data, and UX questions.
- Product fixes are prioritized by pilot impact; custom development is out of scope for the first pilot.
- The buyer should provide one procurement owner, one finance reviewer, and one admin/security contact.

The detailed support boundary is [support-expectations.md](support-expectations.md). Offboarding and recovery boundaries are documented in [data-export-offboarding.md](data-export-offboarding.md) and [backup-restore-statement.md](backup-restore-statement.md).

## Data Export Expectations

The current export expectation is a controller-review XLSX workbook, not a full data warehouse or ERP sync.

Export includes:

- `Portfolio Summary` with reporting basis, active cards, reconciled savings totals, implemented/captured value, finance locks, evidence coverage, phase counts, category totals, buyer totals, last update, and a zero-difference check against exported rows.
- `Saving Cards` with controller-friendly headers, commercial assumptions, phases, ownership, plant/business-unit/category/supplier/material context, finance-lock status, workflow status, last update, cancellation reason, and fallback relation names.
- `Data Dictionary` with field definitions, phase definitions, evidence/finance-lock meaning, exclusions, and the formula `(Baseline Price - New Price) × Annual Volume`.
- `Import Template` with required columns, accepted finance-classification values, and one manufacturing example row.
- `Evidence Summary` with card-level coverage metadata only.
- Customer-facing Savings Type, Impact Type, Impact Recurrence, and Budget Impact columns, plus classification totals in the summary sheet.
- Evidence Count, Evidence Status, Evidence Types, and Last Evidence Upload Date, plus portfolio evidence coverage and finance-stage gaps in the summary sheet.
- No signed URLs, storage paths, bucket names, provider IDs, auth tokens, or credentials.

Traxium helps finance distinguish hard savings, cost avoidance, recurring impact, one-time benefits, and budget-impacting initiatives. This improves review quality without turning the pilot into an ERP implementation.

Import expectations:

- Saving-card import accepts `.xlsx`, validates all rows before write, and commits valid rows in one database transaction.
- If any validation or persistence row fails, no saving cards are imported.
- Row errors identify row number, field, invalid value, message, and suggested correction.
- Imported initiatives start as Proposed so phase-change approvals are not bypassed.
- Buyer, supplier, material, category, plant, and business-unit names are matched or created only inside the active workspace.
- Master-data import supports buyers, suppliers, materials, and categories from CSV or XLSX.
- Plant and business-unit setup should use onboarding/manual entry or inline first-card creation until bulk upload is connected.

The buyer should provide:

- The current Excel savings tracker.
- Buyer, supplier, material, category, plant, and business-unit names.
- Baseline price, new price, annual volume, currency, and impact dates.
- A procurement owner and finance reviewer who can confirm classification and workflow progression after import.

Not included in the first export/import promise:

- ERP sync.
- Public API data extraction.
- Custom workbook layouts per buyer.
- Direct finance-system posting.
- Historical deleted-record archive exports.
- Accounting-recognition calculations, audited-result claims, GAAP treatment, or ERP actual matching.

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
