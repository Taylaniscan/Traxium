# Paid-Pilot Support Expectations

## Purpose

This document defines the operational support boundary for a guided Traxium paid pilot. It is a practical working agreement, not an enterprise service-level agreement.

## Support Scope

Paid-pilot support covers:

- Login and workspace-access questions.
- Invitations, memberships, and role-assignment questions.
- Saving-card creation and update issues.
- Canonical workflow, phase-change request, approval, and finance-lock questions.
- Evidence upload and authorized download issues.
- Import validation and controller-export issues.
- Dashboard, Kanban, Timeline, Command Center, Reports, and Open Actions questions.
- Billing-access and Stripe handoff issues for authorized workspace administrators.
- Reproduction and triage of product defects affecting the agreed pilot.

## Support Hours

- Support is available during the business-hours window agreed in the pilot order, kickoff notes, or buyer handoff.
- Support is email-based through the designated pilot support address.
- A named Traxium pilot contact and a named buyer contact should be agreed at kickoff.
- Requests received outside the agreed support window are handled on the next business day.
- Traxium does not provide 24/7 support during the standard paid pilot.

## Response Targets

These are operating targets, not guaranteed SLA commitments:

- Critical access, billing-access, or evidence-availability issue: best-effort same-business-day attention.
- Normal product, workflow, reporting, import/export, or usability issue: response target within one business day.
- Product feedback and enhancement request: acknowledged and reviewed during the next regular pilot check-in.

Resolution time depends on reproducibility, severity, provider involvement, and whether the request is inside the implemented pilot scope.

## Critical Issues

Examples of critical pilot issues:

- All agreed pilot users cannot sign in.
- The pilot workspace is incorrectly blocked by billing access.
- An authorized user cannot reach required workspace data.
- Evidence needed for an active buyer review cannot be uploaded or downloaded.
- The controller-review export cannot be generated for a scheduled finance review.
- A suspected cross-workspace access issue or evidence exposure is observed.

Suspected cross-tenant access or secret exposure must be escalated immediately to the named Traxium pilot contact and must not be investigated using real unrelated customer data.

## Normal Issues

Examples of normal issues:

- Saving-card field or validation questions.
- Workflow or approval guidance.
- Master-data setup.
- Import row corrections.
- Dashboard or report interpretation.
- User-role clarification.
- Non-blocking usability problems.

## Outside Pilot Support

The standard pilot does not include:

- 24/7 monitoring or support.
- A guaranteed enterprise SLA.
- SSO/SAML or SCIM implementation.
- ERP/MRP integration or accounting posting.
- Custom approval-builder development.
- Custom buyer workbook layouts or BI feeds.
- General procurement consulting unrelated to Traxium use.
- Legal, accounting, tax, audit, or regulatory advice.
- Support for unsupported browsers, modified application code, or buyer-managed infrastructure outside the agreed environment.

## Customer Responsibilities

The buyer should:

- Name one procurement owner, one finance reviewer, and one admin/security contact.
- Use approved pilot accounts rather than shared credentials.
- Report access changes promptly when a user joins, changes role, or leaves the pilot.
- Provide reproducible steps, affected route, approximate time, user role, and non-sensitive screenshots when reporting an issue.
- Avoid sending passwords, provider keys, signed URLs, payment details, or unredacted sensitive procurement documents through support email.
- Review import errors before retrying a workbook.
- Confirm who may approve phase changes and access evidence.

## Data And Evidence Responsibilities

- The buyer decides which procurement data and evidence are appropriate for the pilot.
- Pilot users should upload only files needed to support saving-card review.
- Evidence remains subject to configured file type, size, quota, and access controls.
- The buyer must not send evidence files through the public `/pilot` request form.
- Sensitive files should be handled only through the agreed authenticated evidence flow when that provider flow is configured and validated.

## Browser And Environment Assumptions

- The pilot uses the agreed supported web browser and deployment URL.
- Preview and production environments must use their intended Supabase and Stripe provider modes.
- Browser extensions, corporate proxies, endpoint controls, or blocked third-party domains may affect Auth, Storage, or Stripe flows and may require buyer IT assistance.

## Provider Outages

Supabase, Stripe, Vercel, email delivery, DNS, or other provider incidents may affect the application. Traxium will:

- Confirm whether the issue is inside the application or a provider dependency.
- Communicate the known impact and available workaround.
- Coordinate with the provider when appropriate.
- Avoid promising a resolution time controlled by an external provider.

## Escalation Path

1. Send the issue to the designated pilot support email.
2. Mark critical access, billing, evidence, or suspected isolation issues clearly.
3. Include the workspace name, affected role, route, timestamp, and a redacted screenshot.
4. The named Traxium pilot contact confirms severity and next action.
5. Material pilot blockers are reviewed in the weekly operating review or an earlier focused call.

## No 24/7 Support Statement

Traxium paid-pilot support is business-hours and email-based. No 24/7 support, guaranteed enterprise SLA, or round-the-clock incident-response commitment is included unless separately agreed in writing.

