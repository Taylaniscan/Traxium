# 30-Minute First-Call Script

Founder-led first call for the Traxium guided paid pilot. Goal: surface the Excel-tracker pain and whether finance distrusts the numbers, prove the governed workflow live, and qualify for a pilot.

Demo workspace: **UtopiaTrax** (250-person specialty masterbatch manufacturer). Recommended showcase card: **PP Carrier dual-source negotiation**.

Use customer-facing labels throughout: phases are Proposed → Finance Validated → Implemented → Captured (and Canceled); roles are Procurement Lead, Category Owner, Buyer, Procurement Analyst, Finance Reviewer.

**Qualification gate (read before you offer a pilot):**
> Do **not** propose a pilot on this call unless the buyer can name a Finance Reviewer *and* commit that the Finance Reviewer will join call two. The pilot's whole value is finance trust; without finance in the room, it fails the documented success criteria. If finance is not named, the next step is "bring your finance reviewer to a second call," not a proposal.

---

## 0:00–5:00 — Discovery (5 min)

Keep this conversational; you are listening for the Excel-tracker pain and finance distrust.

Opening: "Before I show anything — walk me through how your team tracks procurement savings today."

Pain-surfacing questions:
1. "Where do savings live right now — Excel, Smartsheet, a deck, email threads?"
2. "When your CFO or controller asks which reported savings actually hit the P&L this year, how long does that answer take?"
3. "If I picked one savings number at random, could someone show me the supplier quote and the approval behind it in under a minute?"
4. "Does finance fully trust procurement's savings numbers today — or do they re-check them?"
5. "Who signs off that a saving is real? Is that step written down anywhere?"
6. "How do you tell hard savings apart from cost avoidance when you report?"

Qualification questions (note the answers):
- "Who owns procurement savings? Who's the finance reviewer who'd validate them?"
- "Do you have a current Excel savings tracker we could start from?"
- "Who would need to look at security before live data — an IT or admin contact?"

Transition: "Let me show you what 'every number carries its proof' actually looks like."

---

## 5:00–20:00 — Live Demo (15 min)

Follow this exact order. If Supabase Auth/Storage or Stripe flows are unavailable in the environment, say so plainly and keep the proof to the app behavior you can show.

### 1. Dashboard (≈3 min) — the portfolio story
- Open `/dashboard`.
- "This is one governed savings register procurement and finance both see — not competing spreadsheets."
- Point to In-Year Value vs Annualized Run-Rate, the phase mix (Proposed → Captured), and category exposure.
- Message: "Every tile here traces back to cards with evidence and approvals — I'll show you."

### 2. A saving card with evidence (≈5 min) — the defensible number
- Open the showcase card (`/saving-cards/<showcase-card-id>`).
- Walk: baseline price, negotiated new price, annual volume, and the calculated savings.
- Show the finance classification: hard savings vs cost avoidance, recurrence, budget impact.
- Open the evidence: supplier quote, price confirmation, calculation workbook, implementation proof — each served through an authenticated download route, not a public link.
- Message: "This is the difference from a spreadsheet — the number and its proof live together."

### 3. Approval request + finance lock (≈4 min) — the control
- From a Proposed/Finance Validated card, request the next phase to show the phase-change approval request.
- "Nothing jumps phases on its own. It waits for the named approvers."
- Switch to the Finance Reviewer, approve in the Action Center, then apply the finance lock.
- Message: "Finance approves, then locks the validated assumptions so the number can't quietly change after sign-off." Note honestly: this is governance, not accounting recognition.

### 4. Controller XLSX export (≈3 min) — what finance keeps
- Open `/reports` and export the controller-review workbook.
- Point to the sheets: Portfolio Summary, Saving Cards, Data Dictionary, Import Template, Evidence Summary.
- "Your controller gets reconciled rows, phase counts, finance locks, and evidence coverage — in USD. No signed URLs, storage paths, or credentials in the file."
- Boundary to state: "This is a controller review workbook, not an ERP sync or a finance-system posting."

---

## 20:00–25:00 — Pilot Offer (5 min)

Only if the qualification gate is met (finance reviewer named and will join call two).

- "What I'd propose is a 45-day guided paid pilot on one workspace, using your real categories and your current Excel tracker as the starting point."
- Included: kickoff, guided first real saving card, at least one phase-change request reviewed through the approval flow, weekly operating reviews, controller-workbook setup, and an end-of-pilot recap with a continue / expand / pause / stop recommendation.
- Price: Starter Pilot is a fixed USD 4,500–7,500 for the pilot period; Growth Pilot (broader stakeholders, more categories/plants, rollout planning) is USD 9,000–15,000. Pricing flexes on onboarding help, stakeholder groups, and security-review depth.
- Support: business-hours, email-based, same-business-day best effort for access/billing/evidence/export issues, one-business-day target otherwise. Not 24/7 and not an enterprise SLA.
- Say the boundaries out loud: no SSO/SAML, no ERP/MRP integration, no custom approval builder, and no SOC 2/ISO certification in the pilot.

---

## 25:00–30:00 — Next Steps (5 min)

- Confirm the three named people: procurement owner, **finance reviewer**, and admin/security contact.
- Book call two with the finance reviewer present.
- Ask them to prepare their current Excel savings tracker (buyer/supplier/material/category names, baseline and new prices, annual volume, currency, impact dates).
- Send: the trust pack, support expectations, the security review checklist, and a controller-review export sample.
- If finance was not named: the agreed next step is a second call with finance — not a proposal.

Close: "Between now and our next call, the one thing to gather is that current tracker — we'll migrate it together at kickoff."
