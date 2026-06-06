# Paid-Pilot Demo Readiness

## Demo Objective

Show that Traxium can replace an Excel savings tracker with a finance-trusted procurement operating record: assumptions, evidence, approvals, phase discipline, delivery tracking, executive reporting, and controller-ready export.

## Demo Audience

- CFO or controller evaluating trust in reported savings.
- Procurement Manager evaluating adoption, ownership, and workflow.
- Category Manager or buyer evaluating day-to-day usability.
- IT or operations stakeholder evaluating roles, private evidence boundaries, and provider dependencies.

## Demo Login Accounts

| User | Account | Use |
| --- | --- | --- |
| Taylan Iscan | `taylaniscan+4@gmail.com` | Main Owner/Procurement Lead flow |
| Mert Dulger | `taylaniscan+5@gmail.com` | Finance Reviewer assigned actions |
| Aylin Demir | `taylaniscan+6@gmail.com` | Category Owner view |
| Can Kaya | `taylaniscan+7@gmail.com` | Buyer operational view |

The shared demo password is documented in `docs/demo-utopiatrax.md`. Do not display it on screen during a recording.

## Demo Route Sequence

1. `/dashboard`
2. `/kanban`
3. `/saving-cards/<showcase-card-id>`
4. `/open-actions`
5. `/command-center`
6. `/timeline`
7. `/reports`
8. `/api/export`
9. `/admin/members`
10. `/admin/settings`
11. `/settings/billing`, only when relevant and presentation-ready

## Showcase Saving Card

**PP Carrier dual-source negotiation**

Use it to show:

- Baseline versus negotiated price.
- Annual volume and calculated savings.
- Supplier Switch / Hard Savings / Recurring / Budget Impact classification.
- Borealis baseline and Sabic benchmark/backup scenario.
- Evidence and approval history.
- Captured workflow status.
- Forecast and confirmed actual volume.

Run `npm run demo:utopiatrax:validate` to print its current ID.

## Required Screenshots

- Dashboard totals, phase mix, and category mix.
- Saving Cards register.
- Populated Kanban.
- Showcase financial case and classification.
- Showcase alternatives and workflow history.
- Showcase evidence list after signed-download proof.
- Open Actions as Finance Reviewer.
- Command Center.
- Timeline and Volume S-Curve.
- Reports and export summary sheet.
- Admin Members.
- Workspace Settings.
- Billing status when provider-ready.

## Pre-Demo Commands

Use only an approved non-production environment:

```bash
npm run db:seed:utopiatrax -- --reset
npm run demo:utopiatrax:validate
npm run typecheck
```

When provider credentials are available:

```bash
npm run supabase:validate
npm run stripe:validate
```

Before the meeting:

- Sign in as the Owner and Finance Reviewer.
- Open every route in the planned sequence.
- Download the export workbook.
- Download one showcase evidence file through the application route.
- Confirm no route shows an empty-state or degraded-load warning.
- Close developer tools and provider dashboards.

## Provider Caveats

- A Prisma evidence record proves metadata, not that a private object can be signed and downloaded.
- A seeded trialing subscription proves app access behavior, not a live Stripe customer, Checkout, Portal, or webhook delivery.
- Prisma users and memberships prove app identity mapping, not successful Supabase Auth login.

Use this statement when provider proof is unavailable:

> Evidence and billing provider flows are not part of this local demo environment. The app behavior is locally verified; provider proof is tracked separately in provider-flow validation.

## Do-Not-Show List

- Raw technical logs, admin jobs, or provider diagnostics.
- Evidence downloads that were not tested in the current environment.
- Stripe billing actions when Stripe is not configured.
- Empty setup pages or cards with intentionally incomplete data.
- Seed commands, passwords, tokens, service keys, storage paths, or full Stripe identifiers.

## Failure Fallback Script

If a provider or route fails:

1. Do not retry repeatedly in front of the buyer.
2. Return to `/dashboard` or `/reports`.
3. Say: “This provider-backed step is tracked separately from the app workflow. I’ll show the governed record and export now, then provide the provider validation evidence after the session.”
4. Record the failed route, user, time, and error after the meeting.
5. Do not claim the failed step passed.

## Buyer Questions This Demo Should Answer

- Can finance trust the number?
- Where is the evidence?
- What is pending approval?
- Which savings are proposed, validated, implemented, captured, or canceled?
- What is the total portfolio value?
- Can we export it?
- Can users have different roles?
- Is evidence private?
- Can we start from Excel?

## Pass/Fail Checklist

- [ ] Seed reset completed in an approved non-production environment.
- [ ] Demo health command passed.
- [ ] Exactly 25 cards and six categories are present.
- [ ] Showcase card ID is known.
- [ ] Owner and Finance Reviewer logins work.
- [ ] Dashboard, Kanban, detail, Open Actions, Command Center, Timeline, and Reports are populated.
- [ ] Export workbook downloads and opens.
- [ ] Showcase evidence download is provider-proven or omitted with caveat.
- [ ] Admin Members shows four users.
- [ ] Workspace Settings and billing access render.
- [ ] No billing block interrupts the route sequence.
- [ ] Screenshots are captured for the intended environment.
- [ ] Preview or production status is claimed only with proof from that environment.
