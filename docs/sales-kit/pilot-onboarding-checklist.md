# 45-Day Pilot Onboarding Checklist

A week-by-week plan for the Traxium guided paid pilot, derived from the success criteria and support model in `../paid-pilot-offer-and-pricing.md`. One manufacturing workspace, one focused procurement/finance/admin working group.

Before anything: complete `../paid-pilot-security-review-checklist.md` with the buyer's data owner and IT/security contact, and confirm the three named people — one procurement owner, one **finance reviewer**, one admin/security contact.

Customer-facing labels only: phases are Proposed → Finance Validated → Implemented → Captured (and Canceled).

---

## Week 1 — Kickoff + Excel tracker migration

**Kickoff session (live):**
- [ ] Confirm pilot scope, success criteria, and the continue/expand/pause/stop decision basis.
- [ ] Confirm workspace name, users, membership roles, and business roles (Procurement Lead, Finance Reviewer, Category Owner, Buyer).
- [ ] Confirm categories, plants (optional — a default Main Plant exists), buyers, and first saving cases.
- [ ] Agree evidence scope and whether private Supabase Storage is configured for the pilot.
- [ ] Walk the UtopiaTrax demo so the team sees the intended operating model before live data.

**Excel tracker migration (via the import flow):**
- [ ] Buyer provides the current Excel savings tracker: buyer/supplier/material/category names, baseline price, new price, annual volume, currency, impact dates.
- [ ] Map tracker columns to the Import Template (from the controller workbook).
- [ ] Run the saving-card XLSX import. Every row is validated before any card is created; if any row fails, no cards are imported.
- [ ] Buyer corrects row-level errors (row number, field, invalid value, message, suggested fix) and re-imports until valid rows commit together.
- [ ] Confirm imported initiatives landed as **Proposed** so approvals are not bypassed.
- [ ] Create the first real saving card by hand with the team (inline master-data creation as needed) to prove the first-card flow.

**Exit check for Week 1:** the team can create/import real saving cards without leaving the first-card flow for missing master data.

---

## Weeks 2–5 — Weekly operating reviews

Four weekly reviews. Keep them ~30–45 minutes, finance present. Each review uses the same agenda.

### Weekly operating review agenda template
1. **Dashboard movement (5 min):** In-Year Value vs Annualized Run-Rate, phase mix changes since last week, category exposure.
2. **Open actions / Action Center (10 min):** pending phase-change requests, who owns each decision, anything stuck. Process at least one phase-change request through the approval flow during the pilot.
3. **Finance review of a card (10 min):** finance reviewer inspects assumptions, evidence, finance-lock state, and decision history on one card; flags Finance Validated/Implemented/Captured cards missing evidence.
4. **Finance locks (5 min):** confirm validated assumptions are locked where appropriate.
5. **Export fit (5 min):** glance at the controller workbook; confirm classifications (hard savings, cost avoidance, recurring, one-time, budget impact) read correctly.
6. **Blockers + next week (5 min):** capture blockers; note any that depend on excluded capabilities (SSO, ERP integration, custom approval builder) so expectations stay clear.

### Week-by-week emphasis
- **Week 2:** breadth — get a representative set of cards in, exercise inline master-data, first phase-change request submitted.
- **Week 3:** finance trust — finance reviewer validates assumptions/evidence on several cards; run at least one approval to Finance Validated and apply a finance lock.
- **Week 4:** workflow depth — move cards toward Implemented/Captured; confirm Dashboard, Board, and export agree after refresh.
- **Week 5:** reporting — generate the controller-review workbook and have finance read it end to end; confirm procurement and finance see the same active portfolio.

**Running success checks across weeks 2–5:**
- [ ] At least one phase-change request reviewed through the approval flow.
- [ ] Finance can inspect assumptions, evidence, finance-lock state, and decision history.
- [ ] Finance can distinguish hard savings, cost avoidance, recurring, one-time, and budget-impacting initiatives in reports and export.
- [ ] Admins can explain membership, role coverage, billing posture, and evidence-storage boundaries.

---

## Weeks 6–7 — End-of-pilot recap + decision

**End-of-pilot recap (live):**
- [ ] Summarize the real saving cards created and reviewed.
- [ ] Show approval and finance-lock evidence.
- [ ] Export the final controller-review XLSX workbook and confirm the buyer can explain what is and isn't included.
- [ ] Document trust/support blockers, including anything that depended on excluded capabilities.
- [ ] Confirm the agreed offboarding/deletion process (manual; no self-service full archive or permanent-deletion workflow).

**Continue / Expand / Pause / Stop decision framework:**
- **Continue:** finance trusts the numbers; keep the same workspace active on the chosen plan.
- **Expand:** move from Starter-style scope to Growth-style — broader stakeholders, more categories/plants, rollout planning.
- **Pause:** export the workbook, document the trust or operational prerequisite blocking, and wait.
- **Stop:** export the workbook, document why Traxium isn't a fit, and close billing cleanly.

**Watch for failure signals (from the offer doc):** finance still doesn't trust the numbers after seeing evidence/assumptions/approvals; the team can't create/update cards without heavy custom support; required trust controls depend on excluded capabilities; or Dashboard/Board/export disagree after refresh.

The handoff package: controller-review XLSX export, summary of saving cards reviewed, approval and finance-lock evidence, trust/support blockers, and a Starter / Growth / no-rollout recommendation.
