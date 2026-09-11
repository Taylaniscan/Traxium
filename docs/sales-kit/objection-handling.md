# Objection Handling

Honest answers for the Traxium guided paid pilot. Where the answer is a current limitation, it is stated plainly using the boundary language from `../trust-pack.md`. Never overclaim past these boundaries. No invented customers, metrics, or testimonials.

---

## "Why not just Smartsheet / Airtable / Monday for $10/user?"

Those are excellent flexible spreadsheets — and that's the problem for savings. In those tools anyone can edit any cell, there's no required evidence on a savings number, no phase-change approval that finance controls, and no way to lock a validated assumption so it can't change after sign-off.

Traxium is purpose-built for one job: a savings register where each card carries its baseline price, new price, annual volume, supporting evidence, an approval trail, and a finance lock, plus a controller-ready XLSX export that separates hard savings, cost avoidance, recurring, and one-time impact.

We don't compete on price per seat. We compete on whether finance trusts the number. If your savings already survive finance review without any of that, you may not need us yet.

---

## "Why not just use our ERP?"

ERPs are systems of record for transactions; they generally don't track the *savings work* — the negotiation, the baseline-vs-new-price case, the evidence, and the procurement-to-finance approval that makes a saving credible.

Be direct about scope: Traxium does **not** integrate with your ERP and does **not** post to your accounting system. There's no ERP/MRP connector and no accounting-system posting in the pilot. We sit alongside the ERP as the governed savings register, and hand finance a reconciled XLSX export they can review. It is a controller review workbook, not ERP synchronization or accounting recognition.

---

## "We need SSO."

Plainly: SSO/SAML (and SCIM) are **not** included in the paid pilot. The pilot uses individual approved accounts with workspace membership roles.

If SSO is a hard prerequisite before any pilot, we're not a fit yet, and I'd rather tell you that now than pretend otherwise. If SSO is a rollout-stage requirement, we can note it as a post-pilot consideration — but I won't promise a delivery date during the pilot conversation.

---

## "We need SOC 2."

We do not hold SOC 2 or ISO 27001 certification, and we don't claim to. I won't dress local tests up as a certification.

What we can give your IT/security reviewer instead is a documented paid-pilot trust boundary: workspace tenant isolation enforced in application authorization and Prisma query constraints (with cross-tenant access tests), private evidence storage with app-mediated signed downloads that expire after 60 seconds, payment data kept in Stripe, a role model, audit events for supported actions, and an explicit list of what we do *not* store or claim. That comes as the trust pack plus a security review checklist your team completes with us before any live data.

If a current SOC 2 report is a gate before any pilot, that's a clean disqualifier today.

---

## "What if you go out of business — how do we get our data out?"

Fair question, and here's the honest version. At any time you can export the controller-review XLSX workbook from Reports — portfolio summary, saving cards with assumptions and classification, phase counts, finance locks, and evidence coverage.

The boundaries, stated the way our trust pack does: the standard workbook does **not** include evidence-file binaries, a complete audit archive, or deleted-record history. There is no self-service full-workspace archive and no automated offboarding workflow. Evidence-file collection may require a manual, separately agreed process depending on your storage provider. We agree the offboarding and deletion process with you before the pilot starts, and the underlying database/storage runs on standard hosting providers (Supabase/Vercel/Stripe) — we don't independently guarantee a provider's backup or recovery for your environment.

So: your savings data is exportable today; full evidence archival is a documented manual step, not a one-click promise.

---

## "It's too expensive for a tracker."

Agreed — if it were just a tracker, it would be. A tracker is what you already have in Excel, and it's the reason finance re-checks the numbers.

What you're buying in the pilot is a founder-led, 45-day guided engagement that gets your real savings into a register where each number is defensible: evidence attached, approvals recorded, finance sign-off, and a controller-ready export. The Starter Pilot is a fixed USD 4,500–7,500 for the pilot period — priced against the cost of a savings number that doesn't hold up at quarter close, not against a per-seat spreadsheet.

If the savings you report each year are small or already trusted without proof, the pilot honestly may not pay for itself, and I'll say so.

---

## "Our buyers won't enter data."

That's the most common reason savings tools die, so we design against it.

- We start from your **current Excel tracker** and migrate it with the validated import — every row is checked first, and if any row fails, nothing is imported, so you fix and retry cleanly.
- Missing master data (buyers, suppliers, materials, categories) can be created inline while creating the first card, so nobody gets blocked hunting for setup.
- Imported initiatives start as Proposed, so the workflow guides what happens next instead of demanding a blank form.
- The weekly operating review keeps the habit small and finance-visible rather than a once-a-quarter data-entry marathon.

We won't claim it's zero effort — but the friction is front-loaded into one guided migration, not pushed onto buyers daily.

---

## "Can it integrate with our ERP actuals?"

No — and I want to be exact about this. Traxium does **not** match ERP actuals, does **not** sync with your ERP, and does **not** perform accounting-recognition calculations, GAAP treatment, or audited-result claims. Those are explicit exclusions.

What it does do is help finance distinguish hard savings, cost avoidance, recurring impact, one-time benefits, and budget-impacting initiatives, with evidence and approvals behind each — and export that for your controller to reconcile against actuals **manually** on their side. If automated ERP actual matching is a requirement before you'd start, we're not the right tool for that today.
