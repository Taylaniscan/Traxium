# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: utopiatrax-demo-runtime.spec.ts >> UtopiaTrax demo routes are populated and controller outputs are usable
- Location: tests/e2e/utopiatrax-demo-runtime.spec.ts:16:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('pp-carrier-supplier-quote.pdf')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText('pp-carrier-supplier-quote.pdf')

```

```yaml
- complementary:
  - heading "Traxium" [level=1]
  - button "Notifications":
    - img
    - text: "2"
  - button "Collapse sidebar":
    - img
  - navigation:
    - link "Dashboard":
      - /url: /dashboard
      - img
      - text: Dashboard
      - img
    - link "Saving Cards":
      - /url: /saving-cards
      - img
      - text: Saving Cards
      - img
    - link "Kanban":
      - /url: /kanban
      - img
      - text: Kanban
      - img
    - link "Timeline":
      - /url: /timeline
      - img
      - text: Timeline
      - img
    - link "Command Center":
      - /url: /command-center
      - img
      - text: Command Center
      - img
    - link "Reports":
      - /url: /reports
      - img
      - text: Reports
      - img
    - link "Workspace Settings":
      - /url: /admin/settings
      - img
      - text: Workspace Settings
      - img
    - link "Open Actions 2 pending actions":
      - /url: /open-actions
      - img
      - text: Open Actions
      - img
  - text: TI
  - paragraph: UtopiaTrax
  - paragraph: Taylan Iscan
  - img
  - text: taylaniscan+4@gmail.com
  - paragraph: Procurement Lead
  - link "Workspace Settings":
    - /url: /admin/settings
  - button "Sign out":
    - img
    - text: Sign out
- main:
  - heading "PP Carrier dual-source negotiation" [level=1]
  - paragraph: Annual contract renegotiation with second-source benchmark.
  - link "Edit Card":
    - /url: /saving-cards/cmq1tw0jr004ufxh8b4kxqcfk/edit
    - button "Edit Card"
  - text: Captured Supplier Switch Hard Savings Finance open
  - paragraph: Executive Case
  - heading "Financial Case" [level=3]
  - paragraph: Baseline €1 to new price €1 across annual volume of 850,000.
  - paragraph: Indicative Savings
  - paragraph: €93.5k
  - paragraph: Savings (USD)
  - paragraph: $93.5k
  - paragraph: Baseline Price
  - paragraph: €1
  - paragraph: Annual Volume
  - paragraph: 850,000
  - paragraph: Commercial narrative
  - paragraph: Annual contract renegotiation with second-source benchmark.
  - text: Baseline Supplier Borealis Polymers Baseline Material PP Homopolymer Carrier Alternative Supplier Sabic Europe Alternative Material Not specified Impact Window Jan 1, 2026 - Dec 31, 2026 Buyer / Category Aylin Demir · Polymer Carriers
  - paragraph: Record Workspace
  - heading "Narrative, Commercial Detail & Scenario Management" [level=2]
  - paragraph: Core record information stays here. Workflow review, finance control, and approval activity remain in the right rail so the operating story and the audit story can be scanned independently.
  - paragraph: Workflow transition
  - text: Captured
  - img
  - text: Canceled Finance open
  - paragraph: Phase change requests continue to use the existing approval flow; this surface only makes the next eligible move easier to see.
  - button "Overview":
    - img
    - text: Overview
  - button "Financials":
    - img
    - text: Financials
  - button "Stakeholders":
    - img
    - text: Stakeholders
  - button "Evidence":
    - img
    - text: Evidence
  - button "Results":
    - img
    - text: Results
  - button "Alternative Suppliers":
    - img
    - text: Alternative Suppliers
  - button "Alternative Materials":
    - img
    - text: Alternative Materials
  - button "Comments":
    - img
    - text: Comments
  - heading "Core Record" [level=3]
  - paragraph: Main sourcing context, business ownership, and core operating data.
  - text: Annual contract renegotiation with second-source benchmark.
  - paragraph: Sourcing Basis
  - paragraph: Baseline Supplier
  - paragraph: Borealis Polymers
  - paragraph: Baseline Material
  - paragraph: PP Homopolymer Carrier
  - paragraph: Alternative Supplier
  - paragraph: Sabic Europe
  - paragraph: Alternative Material
  - paragraph: Not specified
  - paragraph: Business Context
  - paragraph: Phase
  - paragraph: Captured
  - paragraph: Savings Type
  - paragraph: Supplier Switch
  - paragraph: Impact Type
  - paragraph: Hard Savings
  - paragraph: Business Unit
  - paragraph: Packaging Colorants
  - paragraph: Plant
  - paragraph: Apeldoorn Plant
  - heading "Project Attributes" [level=3]
  - paragraph: Initiative classification, delivery effort, and validation readiness.
  - paragraph: Saving Driver
  - paragraph: Dual sourcing
  - paragraph: Implementation Complexity
  - paragraph: Medium
  - paragraph: Qualification Status
  - paragraph: Approved
  - paragraph: Impact Recurrence
  - paragraph: Recurring
  - paragraph: Budget Impact
  - paragraph: Budget Impact
  - paragraph: Buyer
  - paragraph: Aylin Demir
  - paragraph: Category
  - paragraph: Polymer Carriers
  - paragraph: Impact Window
  - paragraph: Jan 1, 2026 - Dec 31, 2026
  - paragraph: Record Summary
  - heading "Audit Snapshot" [level=3]
  - paragraph: High-value commercial, ownership, evidence, and control signals stay pinned here while you review the record.
  - text: Captured Finance open 4 logged approvals
  - paragraph: "Next eligible phase: Canceled"
  - paragraph: Financial Summary
  - text: Baseline Price €1 New Price €1 Annual Volume 850,000 Calculated Savings €93.5k
  - paragraph: Savings Classification
  - text: Savings Type Supplier Switch Impact Type Hard Savings Recurrence Recurring Budget Impact Budget Impact
  - paragraph: Ownership & Scope
  - text: Buyer Aylin Demir Category Polymer Carriers Business Unit Packaging Colorants Plant Apeldoorn Plant
  - paragraph: Evidence & Scenario
  - text: Evidence Files 5 Evidence Size 4.9 KB Latest Upload Nov 12, 2025 Selected Alternative 2 marked as selected
  - paragraph: Workflow Control
  - heading "Review Actions" [level=3]
  - paragraph: Pending approvals and finance controls stay here so the business record remains easy to scan while reviewers still have immediate action access.
  - text: 0 assigned to you 0 open requests Finance open
  - paragraph: Pending for You
  - paragraph: "0"
  - paragraph: Open Requests
  - paragraph: "0"
  - paragraph: Finance Lock
  - paragraph: Open
  - paragraph: Pending approvals
  - text: No pending phase-change approvals are currently assigned to you for this saving card.
  - paragraph: Finance control
  - paragraph: Finance fields are open
  - paragraph: Locking protects baseline price, new price, annual volume, currency, FX rate, calculated savings, impact dates, and savings classification once validation is complete.
  - text: Open
  - button "Lock Finance Fields" [disabled]
  - paragraph: Only authorized finance reviewers can change the lock state.
  - paragraph: Decision history
  - paragraph: Decisions Recorded
  - paragraph: "4"
  - paragraph: All Requests
  - paragraph: "3"
  - heading "Workflow Activity" [level=3]
  - paragraph: Phase requests, approvals, and phase progression are separated from the main business record.
  - paragraph: Phase Requests
  - paragraph: "3"
  - paragraph: Approval Log
  - paragraph: "4"
  - paragraph: Phase Events
  - paragraph: "4"
  - paragraph: Request Ledger
  - paragraph: Implemented to Captured
  - text: approved
  - paragraph: Requested by Aylin Demir on Jan 8, 2026
  - paragraph: Historical demo approval for movement to Captured.
  - paragraph: Finance Validated to Implemented
  - text: approved
  - paragraph: Requested by Aylin Demir on Dec 12, 2025
  - paragraph: Historical demo approval for movement to Implemented.
  - paragraph: Proposed to Finance Validated
  - text: approved
  - paragraph: Requested by Aylin Demir on Nov 8, 2025
  - paragraph: Historical demo approval for movement to Finance Validated.
  - paragraph: Approval Ledger
  - paragraph: Finance Validated · Taylan Iscan
  - text: approved
  - paragraph: approved
  - paragraph: Approved validated phase for demo history.
  - paragraph: Finance Validated · Mert Dulger
  - text: approved
  - paragraph: approved
  - paragraph: Approved validated phase for demo history.
  - paragraph: Implemented · Mert Dulger
  - text: approved
  - paragraph: approved
  - paragraph: Approved implemented phase for demo history.
  - paragraph: Captured · Mert Dulger
  - text: approved
  - paragraph: approved
  - paragraph: Approved achieved phase for demo history.
  - paragraph: Phase History
  - paragraph: Implemented to Captured
  - paragraph: Jan 8, 2026
  - paragraph: Recorded by an assigned workflow participant
  - paragraph: Finance Validated to Implemented
  - paragraph: Dec 12, 2025
  - paragraph: Recorded by an assigned workflow participant
  - paragraph: Proposed to Finance Validated
  - paragraph: Nov 8, 2025
  - paragraph: Recorded by an assigned workflow participant
  - paragraph: Created to Proposed
  - paragraph: Oct 18, 2025
  - paragraph: Recorded by an assigned workflow participant
- alert
```

# Test source

```ts
  1  | import { PrismaClient } from "@prisma/client";
  2  | import { expect, test } from "@playwright/test";
  3  | import * as XLSX from "xlsx";
  4  | 
  5  | import { UTOPIATRAX_SHOWCASE_CARD_TITLE } from "../../scripts/utopiatrax-demo-contract";
  6  | import { loginAs } from "./support/auth";
  7  | import { personas } from "./support/personas";
  8  | import { installRuntimeWatchdog } from "./support/runtime-watchdog";
  9  | 
  10 | const prisma = new PrismaClient();
  11 | 
  12 | test.afterAll(async () => {
  13 |   await prisma.$disconnect();
  14 | });
  15 | 
  16 | test("UtopiaTrax demo routes are populated and controller outputs are usable", async ({
  17 |   page,
  18 | }) => {
  19 |   test.setTimeout(300_000);
  20 |   const watchdog = installRuntimeWatchdog(page);
  21 |   const workspace = await prisma.organization.findUnique({
  22 |     where: { slug: "utopiatrax" },
  23 |     select: {
  24 |       savingCards: {
  25 |         where: { title: UTOPIATRAX_SHOWCASE_CARD_TITLE },
  26 |         select: {
  27 |           id: true,
  28 |           title: true,
  29 |           evidence: {
  30 |             orderBy: { uploadedAt: "asc" },
  31 |             take: 1,
  32 |             select: { id: true, fileName: true },
  33 |           },
  34 |         },
  35 |       },
  36 |     },
  37 |   });
  38 |   const showcase = workspace?.savingCards[0];
  39 |   const evidence = showcase?.evidence[0];
  40 |   expect(showcase).toBeTruthy();
  41 |   expect(evidence).toBeTruthy();
  42 | 
  43 |   await loginAs(page, personas.owner);
  44 | 
  45 |   await page.goto("/dashboard");
  46 |   await expect(page.getByText("No live saving cards yet.")).toHaveCount(0);
  47 |   await expect(page.locator('[data-dashboard-chart-frame="Savings by Phase"]')).toBeVisible();
  48 |   await expect(
  49 |     page.locator('[data-dashboard-chart-frame="Savings by Phase"] svg')
  50 |   ).toBeVisible();
  51 |   await watchdog.checkpoint("UtopiaTrax dashboard");
  52 | 
  53 |   await page.goto("/saving-cards");
  54 |   await expect(page.getByText(UTOPIATRAX_SHOWCASE_CARD_TITLE)).toBeVisible();
  55 |   await watchdog.checkpoint("UtopiaTrax saving cards");
  56 | 
  57 |   await page.goto(`/saving-cards/${showcase?.id}`);
  58 |   await expect(
  59 |     page.getByRole("heading", { name: UTOPIATRAX_SHOWCASE_CARD_TITLE })
  60 |   ).toBeVisible();
> 61 |   await expect(page.getByText(evidence?.fileName ?? "__missing__")).toBeVisible();
     |                                                                     ^ Error: expect(locator).toBeVisible() failed
  62 |   await watchdog.checkpoint("UtopiaTrax showcase detail");
  63 | 
  64 |   const evidenceResponse = await page.request.get(
  65 |     `/api/evidence/${evidence?.id}/download`
  66 |   );
  67 |   expect(evidenceResponse.status()).toBe(200);
  68 |   expect((await evidenceResponse.body()).byteLength).toBeGreaterThan(0);
  69 | 
  70 |   for (const route of ["/open-actions", "/command-center", "/timeline", "/reports"]) {
  71 |     await page.goto(route);
  72 |     await expect(page.locator("main, body")).not.toContainText(
  73 |       /No live saving cards yet|No open actions|No timeline data|Reporting is ready to launch/i
  74 |     );
  75 |     await watchdog.checkpoint(`UtopiaTrax ${route}`);
  76 |   }
  77 | 
  78 |   const exportResponse = await page.request.get("/api/export");
  79 |   expect(exportResponse.status()).toBe(200);
  80 |   const workbook = XLSX.read(await exportResponse.body(), { type: "buffer" });
  81 |   expect(workbook.SheetNames).toEqual(
  82 |     expect.arrayContaining([
  83 |       "Portfolio Summary",
  84 |       "Saving Cards",
  85 |       "Data Dictionary",
  86 |       "Import Template",
  87 |     ])
  88 |   );
  89 |   const exportedText = JSON.stringify(
  90 |     workbook.SheetNames.map((sheetName) =>
  91 |       XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 })
  92 |     )
  93 |   );
  94 |   expect(exportedText).toContain(UTOPIATRAX_SHOWCASE_CARD_TITLE);
  95 |   expect(exportedText).not.toContain("storagePath");
  96 |   expect(exportedText).not.toContain("storageBucket");
  97 |   expect(exportedText).not.toContain("signedUrl");
  98 | });
  99 | 
```