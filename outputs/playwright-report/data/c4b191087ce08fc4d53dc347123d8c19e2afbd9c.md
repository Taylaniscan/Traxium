# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: first-value-onboarding-runtime.spec.ts >> fresh workspace creates its first saving card with inline master data
- Location: tests/e2e/first-value-onboarding-runtime.spec.ts:14:5

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/saving-cards\/[^/?]+\?created=1$/
Received string:  "http://localhost:3100/saving-cards/new"
Timeout: 60000ms

Call log:
  - Expect "toHaveURL" with timeout 60000ms
    121 × unexpected value "http://localhost:3100/saving-cards/new"

```

```yaml
- complementary:
  - heading "Traxium" [level=1]
  - button "Notifications":
    - img
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
    - link "Open Actions":
      - /url: /open-actions
      - img
      - text: Open Actions
      - img
  - text: FW
  - paragraph: EvilTenant E2E
  - paragraph: Foreign Workspace Owner
  - img
  - text: traxium.e2e.foreign.owner@example.com
  - paragraph: Procurement Lead
  - link "Workspace Settings":
    - /url: /admin/settings
  - button "Sign out":
    - img
    - text: Sign out
- main:
  - heading "New Saving Card" [level=1]
  - paragraph: Build the sourcing case, assign ownership, and add financial assumptions without leaving the workflow.
  - heading "First-card setup can stay inside this form" [level=3]
  - paragraph: Some shared master data is still missing, but that should not slow down first value. Buyers, suppliers, materials, categories, plants, and business units can all be created inline below.
  - text: Buyers Suppliers Materials Categories Plants Business Units
  - paragraph: "0 of 6 core master-data collections already have records. Missing today: Buyers, Suppliers, Materials, Categories, Plants, and Business Units."
  - paragraph: Stay in the saving card flow and create what you need inline first. Workspace cleanup and broader standardization can wait until after the first record is live.
  - paragraph: Saving Card
  - heading "Create Saving Card" [level=3]
  - paragraph: Create one real initiative first. You can add more master data, evidence, and team approvals later.
  - text: Proposed Step 3 of 3 Finance lock open
  - paragraph: Shared setup is still in progress
  - paragraph: "Missing today: Buyers, Suppliers, Materials, Categories, Plants, Business Units. This form stays usable, so keep moving here and create any missing records inline as you go."
  - paragraph: Start with the card. Shared setup can happen inline.
  - paragraph: No buyers, suppliers, materials, categories, plants, and business units exist in this workspace yet. Create them directly from this form and Traxium will add them to the active workspace when the card is saved.
  - img
  - text: What are we saving on?
  - img
  - text: What is the financial impact? 3 What happens next?
  - heading "What happens next?" [level=3]
  - paragraph: Add impact dates and the short business case. Create the card first. Then attach evidence and request finance validation.
  - text: Plant No plants yet. Create the first plant inline. New plants default to region Global.
  - paragraph: No existing plant yet
  - paragraph: Start with the first one here. You do not need to leave the saving card form.
  - paragraph: Create first record
  - text: Ready to create on save
  - textbox "Enter first plant name": E2E Plant
  - paragraph: Type the first plant below. Traxium will create it in the active workspace when this card is saved.
  - img
  - text: "Will create in this workspace: E2E Plant Business Unit No business units yet. Create the first business unit inline to complete ownership reporting."
  - paragraph: No existing business unit yet
  - paragraph: Start with the first one here. You do not need to leave the saving card form.
  - paragraph: Create first record
  - text: Ready to create on save
  - textbox "Enter first business unit name": E2E Components
  - paragraph: Type the first business unit below. Traxium will create it in the active workspace when this card is saved.
  - img
  - text: "Will create in this workspace: E2E Components"
  - paragraph: Execution Timeline
  - paragraph: When the initiative work starts and ends.
  - text: Start Date Timeline input
  - textbox: 2026-06-01
  - text: End Date Timeline input
  - textbox: 2026-12-31
  - paragraph: Value Recognition
  - paragraph: When finance should recognize the commercial impact.
  - text: Impact Start Date Recognition date
  - textbox: 2026-07-01
  - paragraph: Finance recognition start; must be on or before the impact end date.
  - text: Impact End Date Recognition date
  - textbox: 2027-06-30
  - paragraph: Finance recognition end; keep this aligned with the value period used for forecast and actual tracking.
  - heading "Governance attributes" [level=3]
  - paragraph: Optional context for later review. These improve triage but do not replace the first-card financial case.
  - text: Saving Driver
  - img
  - combobox:
    - option "Select saving driver" [selected]
    - option "Negotiation"
    - option "Supplier Change"
    - option "Material Substitution"
    - option "Specification Optimization"
    - option "Volume Consolidation"
    - option "Logistics Optimization"
    - option "Payment Term Improvement"
    - option "Demand Reduction"
    - option "Index Reduction"
    - option "Other"
  - text: Implementation Complexity
  - img
  - combobox:
    - option "Select complexity" [selected]
    - option "Low"
    - option "Medium"
    - option "High"
    - option "Strategic"
  - text: Qualification Status
  - img
  - combobox:
    - option "Select qualification status" [selected]
    - option "Not Started"
    - option "Lab Testing"
    - option "Plant Trial"
    - option "Approved"
    - option "Rejected"
  - heading "Stakeholder Coverage" [level=3]
  - paragraph: Select the people who should see the record, provide evidence, or contribute to the approval journey.
  - text: Stakeholders (optional)
  - textbox "Search stakeholders"
  - button "Finance Reviewer Member Finance Reviewer":
    - paragraph: Finance Reviewer Member
    - paragraph: Finance Reviewer
  - button "Foreign Workspace Owner Procurement Lead":
    - paragraph: Foreign Workspace Owner
    - paragraph: Procurement Lead
  - button "Normal Workspace Member Procurement Analyst":
    - paragraph: Normal Workspace Member
    - paragraph: Procurement Analyst
  - paragraph: Search by name, email, or role to assign procurement, finance, sales, production, and development stakeholders consistently.
  - heading "Evidence after save" [level=3]
  - paragraph: Create the card first. Then attach evidence and request finance validation.
  - text: Save the card first, then attach quote, contract or purchase-order, invoice, and calculation evidence before finance validation.
  - paragraph: "Invalid `prisma.auditLog.create()` invocation: Transaction API error: Transaction already closed: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms, however 5200 ms passed since the start of the transaction. Consider increasing the interactive transaction timeout or doing less work in the transaction."
  - button "Cancel"
  - button "Back"
  - button "Save"
  - paragraph: Record Summary
  - heading "Decision Snapshot" [level=3]
  - paragraph: Keep the most decision-relevant signals visible while you complete or update the record.
  - paragraph: Indicative Savings
  - paragraph: €20k
  - paragraph: Current assumptions indicate positive annualized value.
  - text: Proposed
  - paragraph: Financial Summary
  - text: Baseline Price €12 New Price €10 Annual Volume 10,000 Currency / FX EUR / 1
  - paragraph: Calculation Summary
  - text: Calculated Savings (EUR) €20k Calculated Savings (USD) $20k Formula (Baseline price - New price) × Annual volume Frequency RECURRING
  - paragraph: Savings Classification
  - text: Savings Type Price Reduction Impact Type Hard Savings Impact Recurrence Recurring Budget Impact Budget Impact
  - paragraph: Ownership & Scope
  - text: Buyer E2E Buyer Category E2E Resins Business Unit E2E Components Plant E2E Plant
  - paragraph: Evidence & Workflow
  - text: "Alternative Sourcing Not involved Stakeholders None Evidence Files 0 linked Evidence Guidance Save first, then attach quote, contract/PO, invoice, and calculation evidence for finance validation. Approval Status Workflow starts after save Finance Lock Open Finance-controlled fields: baseline price, new price, annual volume, currency, FX rate, impact dates, and savings classification."
- alert
```

# Test source

```ts
  1   | import { PrismaClient } from "@prisma/client";
  2   | import { expect, test } from "@playwright/test";
  3   | 
  4   | import { loginAs } from "./support/auth";
  5   | import { E2E_FOREIGN_WORKSPACE_SLUG, personas } from "./support/personas";
  6   | import { installRuntimeWatchdog } from "./support/runtime-watchdog";
  7   | 
  8   | const prisma = new PrismaClient();
  9   | 
  10  | test.afterAll(async () => {
  11  |   await prisma.$disconnect();
  12  | });
  13  | 
  14  | test("fresh workspace creates its first saving card with inline master data", async ({
  15  |   page,
  16  | }) => {
  17  |   test.setTimeout(240_000);
  18  |   const watchdog = installRuntimeWatchdog(page);
  19  |   await loginAs(page, personas.foreignOwner);
  20  | 
  21  |   await page.goto("/onboarding");
  22  |   await expect(
  23  |     page.getByRole("link", { name: "Create first saving card" }).first()
  24  |   ).toBeVisible();
  25  |   await watchdog.checkpoint("fresh workspace onboarding");
  26  | 
  27  |   await page.goto("/saving-cards/new");
  28  |   await page.getByPlaceholder("Enter initiative title").fill("E2E resin recovery");
  29  |   await page
  30  |     .getByPlaceholder(
  31  |       "Summarize the sourcing opportunity, business case, and expected impact."
  32  |     )
  33  |     .fill("Renegotiate resin pricing against the current annual demand baseline.");
  34  |   await page.getByPlaceholder("Enter first buyer name").fill("E2E Buyer");
  35  |   await page
  36  |     .getByPlaceholder("Enter first current supplier name")
  37  |     .fill("E2E Supplier");
  38  |   await page
  39  |     .getByPlaceholder("Enter first current material name")
  40  |     .fill("E2E Resin");
  41  |   await page.getByPlaceholder("Enter first category name").fill("E2E Resins");
  42  |   await page.getByRole("button", { name: "Next" }).click();
  43  | 
  44  |   const financialInputs = page.locator('input[type="number"]');
  45  |   await expect(financialInputs).toHaveCount(4);
  46  |   await financialInputs.nth(0).fill("12");
  47  |   await financialInputs.nth(1).fill("10");
  48  |   await financialInputs.nth(2).fill("10000");
  49  |   await financialInputs.nth(3).fill("1");
  50  |   await expect(page.getByText("Calculated Savings: €20k")).toBeVisible();
  51  |   await page.getByRole("button", { name: "Next" }).click();
  52  | 
  53  |   await page.getByPlaceholder("Enter first plant name").fill("E2E Plant");
  54  |   await page
  55  |     .getByPlaceholder("Enter first business unit name")
  56  |     .fill("E2E Components");
  57  |   const dateInputs = page.locator('input[type="date"]');
  58  |   await expect(dateInputs).toHaveCount(4);
  59  |   await dateInputs.nth(0).fill("2026-06-01");
  60  |   await dateInputs.nth(1).fill("2026-12-31");
  61  |   await dateInputs.nth(2).fill("2026-07-01");
  62  |   await dateInputs.nth(3).fill("2027-06-30");
  63  |   await page.getByRole("button", { name: "Save" }).click();
  64  | 
> 65  |   await expect(page).toHaveURL(/\/saving-cards\/[^/?]+\?created=1$/, {
      |                      ^ Error: expect(page).toHaveURL(expected) failed
  66  |     timeout: 60_000,
  67  |   });
  68  |   await expect(
  69  |     page.getByRole("heading", { name: "E2E resin recovery" })
  70  |   ).toBeVisible();
  71  |   await expect(page.getByText("First saving card created")).toBeVisible();
  72  |   await expect(page.getByRole("link", { name: "Attach evidence" })).toBeVisible();
  73  |   await expect(
  74  |     page.getByRole("link", { name: "Request validation" })
  75  |   ).toBeVisible();
  76  |   await expect(page.getByRole("link", { name: "Open dashboard" })).toBeVisible();
  77  |   await watchdog.checkpoint("first saving card detail");
  78  | 
  79  |   const workspace = await prisma.organization.findUnique({
  80  |     where: { slug: E2E_FOREIGN_WORKSPACE_SLUG },
  81  |     select: {
  82  |       savingCards: {
  83  |         where: { title: "E2E resin recovery" },
  84  |         select: {
  85  |           calculatedSavings: true,
  86  |           phase: true,
  87  |           buyer: { select: { name: true } },
  88  |           supplier: { select: { name: true } },
  89  |           material: { select: { name: true } },
  90  |           category: { select: { name: true } },
  91  |         },
  92  |       },
  93  |     },
  94  |   });
  95  |   expect(workspace?.savingCards).toEqual([
  96  |     expect.objectContaining({
  97  |       calculatedSavings: 20_000,
  98  |       phase: "IDEA",
  99  |       buyer: { name: "E2E Buyer" },
  100 |       supplier: { name: "E2E Supplier" },
  101 |       material: { name: "E2E Resin" },
  102 |       category: { name: "E2E Resins" },
  103 |     }),
  104 |   ]);
  105 | 
  106 |   await page.getByRole("link", { name: "Open dashboard" }).click();
  107 |   await expect(page).toHaveURL(/\/dashboard$/);
  108 |   await expect(page.getByText("€20k").first()).toBeVisible();
  109 |   await watchdog.checkpoint("first card reflected on dashboard");
  110 | });
  111 | 
```