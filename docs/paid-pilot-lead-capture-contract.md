# Paid-Pilot Lead-Capture Contract

## Purpose

The public lead-capture flow allows qualified US manufacturing and industrial SME buyers to request a guided Traxium paid pilot.

Traxium is founder-led and sales-led at this stage. Submitting the form requests a fit review and follow-up; it does not create an account, create a workspace, start a trial, or activate billing.

## Root-Cause Note

The public homepage already explains Traxium's paid-pilot positioning, UtopiaTrax proof, finance-reviewed workflow, private evidence model, and controller-ready export.

The conversion path was incomplete:

- The only homepage actions were `Sign in` and `View product`.
- `View product` pointed at the authenticated `/dashboard` route.
- There was no public pilot-request page or lead-capture API.
- No lead record was stored.
- No public-form validation, honeypot, duplicate handling, or rate limit existed.
- The current job/email infrastructure is designed for authentication emails, not sales notifications.
- The copy described a guided pilot but did not give an unauthenticated qualified buyer a real way to request one.

Gap 9 adds a narrow B2B paid-pilot funnel without creating self-serve provisioning, a generic CRM, or a public product-data route.

## Target Buyer

The form is intended for:

- Procurement Manager
- Procurement Lead
- CFO or Finance Director
- Controller or Finance Reviewer
- COO or Operations Leader
- Owner or Managing Director

## Qualification Criteria

The request should help determine whether the company:

- Operates in manufacturing or industrial distribution.
- Has approximately 50-500 employees.
- Tracks procurement savings today.
- Uses Excel, email, PowerPoint, or another manual tracker.
- Has finance-review, evidence, approval, ownership, or savings-reporting pain.
- Has a current savings tracker that could be reviewed or imported.
- Can participate in a guided 30-45 day paid pilot.

The form is qualification, not full procurement discovery. It must stay short enough for a serious buyer to complete in a few minutes.

## CTA Promise

Allowed public promises:

- Request a paid pilot.
- Request a demo.
- Discuss whether Traxium fits the buyer's procurement and finance workflow.
- Review the buyer's current savings tracker.
- Set up a guided workspace using real savings data if both parties agree to proceed.

The public CTA must not promise:

- Instant access.
- A free trial.
- Self-serve signup or workspace creation.
- SOC 2 certification.
- ERP or MRP integration.
- Accounting posting or audited financial recognition.
- Fully automated savings validation.
- Guaranteed savings.
- 24/7 support.

## Lead Fields

Required:

- Full name
- Work email
- Company name

Recommended qualification fields:

- Job title
- Company size
- Industry
- Current savings tracking method
- Biggest savings reporting pain
- Existing savings tracker: yes or no
- Pilot timeline
- Additional message

The form must not accept procurement-file attachments. A current tracker can be reviewed later through an agreed secure pilot process.

## Lead Handling

A lead submission must:

- Validate all accepted fields and reject unexpected fields.
- Enforce a public IP-scoped rate limit before writing.
- Include a honeypot field that real users do not interact with.
- Silently accept a honeypot-filled request without creating a normal lead.
- Store a normalized lead record in PostgreSQL.
- Store no raw IP address.
- Store IP or user-agent hashes only when the configured hashing secret is available.
- Suppress a recent duplicate for the same normalized work email and company while returning the normal success response.
- Return field-level validation errors without exposing stack traces or database details.
- Never create a user account, organization, membership, billing record, or workspace.

Public pilot leads are platform-level sales records, not customer-workspace records. Traxium currently has tenant-scoped Owner/Admin roles but no platform-sales administrator role, so Gap 9 does not expose global pilot leads inside a workspace admin page.

## Notification Decision

Lead notification is not implemented in Gap 9.

The existing job/email infrastructure is limited to Supabase authentication invitation and password-recovery delivery. Lead storage must succeed independently of a future sales-notification provider. Until a dedicated internal notification destination and handler are configured, founders or operators review `PilotLead` records through approved database operations.

This limitation must be documented and must not cause the public form to imply that an email notification was sent.

## Success Message

The public success state is:

> Thanks - we received your request. Traxium is currently offered through guided paid pilots for qualified manufacturing teams. We'll review your request and follow up if there is a strong fit.

The same success response is used for recent duplicates and honeypot submissions so the API does not disclose abuse-detection behavior.

## Route Contract

- Primary public route: `/pilot`
- Compatibility route: `/request-demo`, redirected to `/pilot`
- Public API route: `POST /api/pilot-leads`
- Homepage primary CTA: `Request paid pilot`
- Homepage secondary CTA: `See UtopiaTrax demo`

The secondary CTA points to the public UtopiaTrax preview on `/pilot`; it never opens an authenticated internal workspace route.

## Proof Expectations

Readiness requires:

- Validation tests for required fields, enums, email format, and length limits.
- API tests for storage, duplicate suppression, honeypot behavior, rate limiting, controlled errors, and no account/workspace creation.
- Page tests for buyer qualification, pilot steps, exclusions, and CTA language.
- Homepage tests proving the public CTA points to `/pilot` and does not advertise a free trial.
- Prisma schema and migration validation.
- Local browser proof of homepage navigation, client validation, valid submission, persisted lead, duplicate behavior, and no account/workspace creation.
- Preview or production status only after a real submission is completed in that environment.

## Manual Proof Checklist

1. Open `/`.
2. Confirm the primary CTA says `Request paid pilot`.
3. Confirm the CTA links to `/pilot`.
4. Confirm the secondary UtopiaTrax CTA stays on public routes.
5. Open `/pilot`.
6. Submit the empty form and confirm field-level validation.
7. Submit an invalid work email and confirm the email error.
8. Submit a valid test lead.
9. Confirm the approved success message.
10. Confirm one `PilotLead` record exists in the database.
11. Submit the same work email and company again and confirm no duplicate record is created.
12. Submit a honeypot-filled request directly and confirm no normal lead is created.
13. Exceed the public rate limit from a test IP and confirm HTTP 429.
14. Confirm no User, Organization, Membership, or billing record was created.
15. Confirm `/request-demo` redirects to `/pilot`.
16. Confirm the page does not promise a free trial, ERP integration, accounting posting, SOC 2, guaranteed savings, or 24/7 support.
17. Record the environment, test lead ID, screenshots, and any blockers.
