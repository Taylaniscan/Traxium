# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: runtime-route-smoke.spec.ts >> owner can render every protected primary route cleanly
- Location: tests/e2e/runtime-route-smoke.spec.ts:64:5

# Error details

```
Test timeout of 300000ms exceeded.
```

```
Error: locator.click: Test timeout of 300000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: 'Saving Cards', exact: true })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - generic [ref=e6]:
            - generic [ref=e7]:
              - generic [ref=e8]: Guided setup
              - generic [ref=e9]: 5 of 7 steps completed
            - heading "Set up UtopiaTrax for first value" [level=3] [ref=e10]
            - paragraph [ref=e11]: Taylan, this wizard helps a new workspace move from empty account to one credible procurement savings card before setup cleanup.
          - generic [ref=e12]:
            - generic [ref=e14]:
              - generic [ref=e15]:
                - paragraph [ref=e16]: First-value progress
                - paragraph [ref=e17]: 100%
              - generic [ref=e18]:
                - paragraph [ref=e19]: Next best action
                - paragraph [ref=e20]: Open dashboard for first portfolio review
            - generic [ref=e23]: Start with one real savings initiative. You can complete master data later. Use sample data only for demo/training; use real data when preparing a pilot or customer workspace.
            - generic [ref=e24]:
              - link "Create first saving card" [ref=e25] [cursor=pointer]:
                - /url: /saving-cards/new
              - link "Continue later" [ref=e26] [cursor=pointer]:
                - /url: /dashboard
        - generic [ref=e27]:
          - generic [ref=e28]:
            - heading "Create one real saving card first" [level=3] [ref=e29]
            - paragraph [ref=e30]: Start with one real savings initiative. You can complete master data later.
          - generic [ref=e31]:
            - generic [ref=e32]: Use sample data only for demo/training. Use real data when preparing a pilot or customer workspace.
            - generic [ref=e33]:
              - link "Create first saving card" [ref=e34] [cursor=pointer]:
                - /url: /saving-cards/new?from=onboarding
              - paragraph [ref=e35]: "Primary path: create one real saving card before setup cleanup."
            - generic [ref=e36]:
              - button "Load sample data" [ref=e38]
              - link "Review readiness" [ref=e39] [cursor=pointer]:
                - /url: /onboarding
              - link "Continue later" [ref=e40] [cursor=pointer]:
                - /url: /dashboard
              - link "Invite team members in Admin Members" [ref=e41] [cursor=pointer]:
                - /url: /admin/members
      - generic [ref=e42]:
        - generic [ref=e43]:
          - heading "First-value readiness" [level=3] [ref=e44]
          - paragraph [ref=e45]: Required checks keep the first saving card credible. Recommended checks improve reporting, but they should not stop you from starting.
        - generic [ref=e46]:
          - generic [ref=e47]:
            - paragraph [ref=e48]: First-value progress
            - paragraph [ref=e49]: 100%
            - paragraph [ref=e50]: 5 of 5 required checks ready
          - generic [ref=e53]:
            - generic [ref=e54]:
              - paragraph [ref=e55]: Saving cards
              - paragraph [ref=e56]: "25"
            - generic [ref=e57]:
              - paragraph [ref=e58]: Buyers
              - paragraph [ref=e59]: "4"
            - generic [ref=e60]:
              - paragraph [ref=e61]: Suppliers
              - paragraph [ref=e62]: "25"
            - generic [ref=e63]:
              - paragraph [ref=e64]: Optional gaps
              - paragraph [ref=e65]: "0"
          - generic [ref=e66]:
            - paragraph [ref=e67]: Required for first value
            - generic [ref=e68]:
              - generic [ref=e69]:
                - generic [ref=e70]: Ready
                - generic [ref=e71]:
                  - paragraph [ref=e72]: Workspace identity
                  - paragraph [ref=e73]: Name and tenant boundary are ready for procurement savings work.
              - generic [ref=e74]:
                - generic [ref=e75]: Ready
                - generic [ref=e76]:
                  - paragraph [ref=e77]: At least one buyer
                  - paragraph [ref=e78]: A named owner keeps the first saving card accountable.
              - generic [ref=e79]:
                - generic [ref=e80]: Ready
                - generic [ref=e81]:
                  - paragraph [ref=e82]: At least one supplier
                  - paragraph [ref=e83]: A supplier makes baseline and new price comparison credible.
              - generic [ref=e84]:
                - generic [ref=e85]: Ready
                - generic [ref=e86]:
                  - paragraph [ref=e87]: At least one material or category
                  - paragraph [ref=e88]: One commercial scope dimension is enough to start first value.
              - generic [ref=e89]:
                - generic [ref=e90]: Ready
                - generic [ref=e91]:
                  - paragraph [ref=e92]: At least one saving card
                  - paragraph [ref=e93]: First value is created from one real savings initiative.
          - generic [ref=e94]:
            - paragraph [ref=e95]: Recommended for better reporting
            - generic [ref=e96]:
              - generic [ref=e97]:
                - generic [ref=e98]: Ready
                - generic [ref=e99]:
                  - paragraph [ref=e100]: Plants
                  - paragraph [ref=e101]: Useful for site-level savings reporting.
              - generic [ref=e102]:
                - generic [ref=e103]: Ready
                - generic [ref=e104]:
                  - paragraph [ref=e105]: Business units
                  - paragraph [ref=e106]: Useful for division-level portfolio reviews.
              - generic [ref=e107]:
                - generic [ref=e108]: Ready
                - generic [ref=e109]:
                  - paragraph [ref=e110]: More complete categories
                  - paragraph [ref=e111]: Improves ownership, targets, and reports.
              - generic [ref=e112]:
                - generic [ref=e113]: Ready
                - generic [ref=e114]:
                  - paragraph [ref=e115]: Finance reviewer/team setup
                  - paragraph [ref=e116]: Finance validation and procurement approvals become clearer.
              - generic [ref=e117]:
                - generic [ref=e118]: Ready
                - generic [ref=e119]:
                  - paragraph [ref=e120]: Evidence can be attached to saving cards
                  - paragraph [ref=e121]: After a card exists, attach quote, contract, invoice, and calculation evidence for finance trust.
      - generic [ref=e122]:
        - generic [ref=e123]:
          - generic [ref=e124]:
            - generic [ref=e125]: Complete
            - generic [ref=e126]: Step 1 of 7
          - heading "Workspace identity" [level=3] [ref=e127]
          - paragraph [ref=e128]: This workspace is where your procurement savings initiatives, evidence, approvals, and reports will live.
        - generic [ref=e129]:
          - generic [ref=e130]:
            - generic [ref=e131]:
              - paragraph [ref=e132]: Workspace name
              - paragraph [ref=e133]: UtopiaTrax
            - generic [ref=e134]:
              - paragraph [ref=e135]: Short description
              - paragraph [ref=e136]: Specialty masterbatch and compound manufacturing demo workspace for finance-trusted procurement savings governance.
          - link "Review workspace identity" [ref=e138] [cursor=pointer]:
            - /url: /admin/settings
      - generic [ref=e139]:
        - generic [ref=e140]:
          - generic [ref=e141]:
            - generic [ref=e142]: Complete
            - generic [ref=e143]: Step 2 of 7
          - heading "First saving card" [level=3] [ref=e144]
          - paragraph [ref=e145]: First value comes from one complete savings card, not from perfect setup.
        - generic [ref=e147]:
          - generic [ref=e148]:
            - paragraph [ref=e149]: Current saving cards
            - paragraph [ref=e150]: "25"
            - paragraph [ref=e151]: At least one saving card exists, so this step is complete.
          - generic [ref=e152]:
            - paragraph [ref=e153]: Add baseline price, new price, annual volume, currency, and impact dates. Attach evidence if available and submit a phase change when the record is ready for review.
            - paragraph [ref=e154]: You can complete master data later. Traxium becomes more useful as your data improves.
            - link "Create first saving card" [ref=e155] [cursor=pointer]:
              - /url: /saving-cards/new
      - generic [ref=e156]:
        - generic [ref=e157]:
          - generic [ref=e158]:
            - generic [ref=e159]: Complete
            - generic [ref=e160]: Step 3 of 7
          - heading "Business structure and master data" [level=3] [ref=e161]
          - paragraph [ref=e162]: Add enough procurement structure to create a credible first saving card. You do not need a perfect setup to begin.
        - generic [ref=e164]:
          - generic [ref=e165]: Start with one real savings initiative. Buyers, suppliers, and either a material or category are enough for first value. Plants and business units can be completed later for better reporting.
          - generic [ref=e166]:
            - generic [ref=e167]:
              - generic [ref=e168]:
                - generic [ref=e169]:
                  - paragraph [ref=e170]: Buyers
                  - paragraph [ref=e171]: "Current count: 4"
                - generic [ref=e172]: Ready
              - paragraph [ref=e173]: Buyers show who owns a savings initiative and who should keep it moving.
              - generic [ref=e174]:
                - link "Download template" [ref=e175] [cursor=pointer]:
                  - /url: /api/onboarding/master-data-template/buyers
                - button "Add manually" [ref=e177]
            - generic [ref=e178]:
              - generic [ref=e179]:
                - generic [ref=e180]:
                  - paragraph [ref=e181]: Suppliers
                  - paragraph [ref=e182]: "Current count: 25"
                - generic [ref=e183]: Ready
              - paragraph [ref=e184]: Suppliers make baseline and negotiated prices credible instead of anonymous.
              - generic [ref=e185]:
                - link "Download template" [ref=e186] [cursor=pointer]:
                  - /url: /api/onboarding/master-data-template/suppliers
                - button "Add manually" [ref=e188]
            - generic [ref=e189]:
              - generic [ref=e190]:
                - generic [ref=e191]:
                  - paragraph [ref=e192]: Materials
                  - paragraph [ref=e193]: "Current count: 28"
                - generic [ref=e194]: Ready
              - paragraph [ref=e195]: Materials anchor volume, price, and scope so savings calculations are concrete.
              - generic [ref=e196]:
                - link "Download template" [ref=e197] [cursor=pointer]:
                  - /url: /api/onboarding/master-data-template/materials
                - button "Add manually" [ref=e199]
            - generic [ref=e200]:
              - generic [ref=e201]:
                - generic [ref=e202]:
                  - paragraph [ref=e203]: Categories
                  - paragraph [ref=e204]: "Current count: 6"
                - generic [ref=e205]: Ready
              - paragraph [ref=e206]: Categories make savings easier to review by procurement area and ownership.
              - generic [ref=e207]:
                - link "Download template" [ref=e208] [cursor=pointer]:
                  - /url: /api/onboarding/master-data-template/categories
                - button "Add manually" [ref=e210]
            - generic [ref=e211]:
              - generic [ref=e212]:
                - generic [ref=e213]:
                  - paragraph [ref=e214]: Plants
                  - paragraph [ref=e215]: "Current count: 4"
                - generic [ref=e216]: Ready
              - paragraph [ref=e217]: Plants show where operational impact lands and improve site-level reporting.
              - generic [ref=e218]:
                - link "Download template" [ref=e219] [cursor=pointer]:
                  - /url: /api/onboarding/master-data-template/plants
                - button "Add manually" [ref=e221]
            - generic [ref=e222]:
              - generic [ref=e223]:
                - generic [ref=e224]:
                  - paragraph [ref=e225]: Business Units
                  - paragraph [ref=e226]: "Current count: 5"
                - generic [ref=e227]: Ready
              - paragraph [ref=e228]: Business units help leaders compare savings by division or operating group.
              - generic [ref=e229]:
                - link "Download template" [ref=e230] [cursor=pointer]:
                  - /url: /api/onboarding/master-data-template/businessUnits
                - button "Add manually" [ref=e232]
          - generic [ref=e233]:
            - generic [ref=e234]:
              - heading "Upload-ready template" [level=3] [ref=e235]
              - paragraph [ref=e236]: Use the next missing upload-ready area below, or download any template from the cards above.
            - generic [ref=e239]:
              - generic [ref=e240]:
                - generic [ref=e241]:
                  - generic [ref=e242]: ✓
                  - generic [ref=e243]:
                    - generic [ref=e244]:
                      - paragraph [ref=e245]: Step 3
                      - generic [ref=e246]: Complete
                    - generic [ref=e247]:
                      - heading "Set up buyers" [level=3] [ref=e248]
                      - paragraph [ref=e249]: Upload buyers first so commercial ownership is ready before the first live saving card is created.
                    - paragraph [ref=e250]: 4 buyers already configured.
                    - paragraph [ref=e251]: Manual fallback stays available from the first saving card form if you only need one or two buyers right now.
                - generic [ref=e252]:
                  - paragraph [ref=e253]: Upload first
                  - paragraph [ref=e254]: Use a template to prepare buyers in bulk. Manual entry stays available as a fallback when you only need a small number of records.
                  - generic [ref=e255]:
                    - button "Upload file" [ref=e256]
                    - button "Add manually" [ref=e258]
                    - link "Download template" [ref=e259] [cursor=pointer]:
                      - /url: /api/onboarding/master-data-template/buyers
                  - paragraph [ref=e260]: "Accepted in onboarding right now: CSV (.csv), Excel workbook (.xlsx)."
              - generic [ref=e261]:
                - generic [ref=e262]:
                  - paragraph [ref=e263]: Field guide
                  - generic [ref=e264]:
                    - generic [ref=e265]:
                      - paragraph [ref=e266]: Accepted file types
                      - generic [ref=e267]:
                        - generic [ref=e268]:
                          - generic [ref=e269]: CSV (.csv)
                          - generic [ref=e270]: Excel workbook (.xlsx)
                        - paragraph [ref=e271]: Download the CSV template and keep the column names exactly as shown below.
                    - generic [ref=e272]:
                      - paragraph [ref=e273]: Use these column names exactly
                      - code [ref=e275]: name, email, code, department
                    - generic [ref=e276]:
                      - paragraph [ref=e277]: Required columns
                      - generic [ref=e280]:
                        - generic [ref=e281]:
                          - paragraph [ref=e282]: name
                          - generic [ref=e283]: Required
                        - paragraph [ref=e284]: The buyer name people should recognize in Traxium.
                    - generic [ref=e285]:
                      - paragraph [ref=e286]: Optional columns
                      - generic [ref=e288]:
                        - generic [ref=e289]:
                          - generic [ref=e290]:
                            - paragraph [ref=e291]: email
                            - generic [ref=e292]: Optional
                          - paragraph [ref=e293]: Work email for the buyer, if you want it available from day one.
                        - generic [ref=e294]:
                          - generic [ref=e295]:
                            - paragraph [ref=e296]: code
                            - generic [ref=e297]: Optional
                          - paragraph [ref=e298]: Internal buyer code, if your team already uses one.
                        - generic [ref=e299]:
                          - generic [ref=e300]:
                            - paragraph [ref=e301]: department
                            - generic [ref=e302]: Optional
                          - paragraph [ref=e303]: Department or team the buyer belongs to.
                - generic [ref=e304]:
                  - paragraph [ref=e305]: Example row
                  - paragraph [ref=e306]: This example shows one complete row with optional fields filled in. If you do not use an optional field yet, you can leave that cell blank.
                  - table [ref=e308]:
                    - rowgroup [ref=e309]:
                      - row "name email code department" [ref=e310]:
                        - columnheader "name" [ref=e311]
                        - columnheader "email" [ref=e312]
                        - columnheader "code" [ref=e313]
                        - columnheader "department" [ref=e314]
                    - rowgroup [ref=e315]:
                      - row "Taylor Buyer taylor.buyer@company.com BUY-001 Procurement" [ref=e316]:
                        - cell "Taylor Buyer" [ref=e317]
                        - cell "taylor.buyer@company.com" [ref=e318]
                        - cell "BUY-001" [ref=e319]
                        - cell "Procurement" [ref=e320]
                - generic [ref=e321]:
                  - paragraph [ref=e322]: Result summary
                  - generic [ref=e323]:
                    - paragraph [ref=e324]: This step is already marked complete from live readiness.
                    - paragraph [ref=e325]: Traxium currently sees 4 buyers in the workspace.
      - generic [ref=e326]:
        - generic [ref=e327]:
          - generic [ref=e328]:
            - generic [ref=e329]: Recommended
            - generic [ref=e330]: Step 4 of 7
          - heading "Evidence and finance trust" [level=3] [ref=e331]
          - paragraph [ref=e332]: Finance trust improves when savings cards include evidence and approval history.
        - generic [ref=e334]:
          - generic [ref=e335]:
            - generic [ref=e336]: Supplier quote or bid
            - generic [ref=e337]: Contract or purchase order
            - generic [ref=e338]: Invoice or actual proof
            - generic [ref=e339]: Calculation workbook
            - generic [ref=e340]: Finance approval support
          - generic [ref=e341]:
            - paragraph [ref=e342]: Evidence upload is available inside the saving card context after a record exists. Keep supporting files linked to the relevant card so approval history and finance validation stay together.
            - link "Open Saving Cards" [ref=e343] [cursor=pointer]:
              - /url: /saving-cards
      - generic [ref=e344]:
        - generic [ref=e345]:
          - generic [ref=e346]:
            - generic [ref=e347]: Complete
            - generic [ref=e348]: Step 5 of 7
          - heading "Team coverage" [level=3] [ref=e349]
          - paragraph [ref=e350]: Workspace access controls settings and billing. Business roles cover sourcing ownership, procurement approval, and finance review.
        - generic [ref=e352]:
          - generic [ref=e353]:
            - generic [ref=e354]:
              - generic [ref=e355]:
                - paragraph [ref=e356]: Workspace Admin / Owner
                - generic [ref=e357]: Available
              - paragraph [ref=e358]: Your current workspace access is owner. Owners and admins control workspace setup, members, and billing settings.
            - generic [ref=e359]:
              - generic [ref=e360]:
                - paragraph [ref=e361]: Finance Reviewer
                - generic [ref=e362]: Covered
              - paragraph [ref=e363]: Needed for finance validation and confidence in reported savings.
            - generic [ref=e364]:
              - generic [ref=e365]:
                - paragraph [ref=e366]: Procurement Lead
                - generic [ref=e367]: Covered
              - paragraph [ref=e368]: Needed for validated approvals and procurement governance.
            - generic [ref=e369]:
              - generic [ref=e370]:
                - paragraph [ref=e371]: Category owners and buyers
                - generic [ref=e372]: Covered
              - paragraph [ref=e373]: Category owners and buyers keep saving cards moving through real commercial workflow.
          - generic [ref=e374]:
            - paragraph [ref=e375]: Invite team members in Admin Members. Onboarding explains who is needed, but the member and invitation system stays in the admin area.
            - link "Invite team members in Admin Members" [ref=e376] [cursor=pointer]:
              - /url: /admin/members
      - generic [ref=e377]:
        - generic [ref=e378]:
          - generic [ref=e379]:
            - generic [ref=e380]: Complete
            - generic [ref=e381]: Step 6 of 7
          - heading "Reporting and dashboard" [level=3] [ref=e382]
          - paragraph [ref=e383]: Move from setup into the operating surfaces your team will use every week.
        - generic [ref=e385]:
          - paragraph [ref=e387]: Your workspace is ready for first portfolio review.
          - generic [ref=e388]:
            - generic [ref=e389]:
              - paragraph [ref=e390]: Dashboard
              - paragraph [ref=e391]: Portfolio totals and current savings value.
            - generic [ref=e392]:
              - paragraph [ref=e393]: Kanban
              - paragraph [ref=e394]: Move savings initiatives through workflow stages.
            - generic [ref=e395]:
              - paragraph [ref=e396]: Open Actions
              - paragraph [ref=e397]: See approvals and pending work.
            - generic [ref=e398]:
              - paragraph [ref=e399]: Reports
              - paragraph [ref=e400]: Review executive summaries and exports.
            - generic [ref=e401]:
              - paragraph [ref=e402]: Command Center
              - paragraph [ref=e403]: Compare portfolio and governance signals.
          - generic [ref=e404]:
            - link "Go to Dashboard" [ref=e405] [cursor=pointer]:
              - /url: /dashboard
            - link "Go to Reports" [ref=e406] [cursor=pointer]:
              - /url: /reports
            - link "Go to Kanban" [ref=e407] [cursor=pointer]:
              - /url: /kanban
      - generic [ref=e408]:
        - generic [ref=e409]:
          - generic [ref=e410]:
            - generic [ref=e411]: Complete
            - generic [ref=e412]: Step 7 of 7
          - heading "Finish or continue later" [level=3] [ref=e413]
          - paragraph [ref=e414]: Use this checkpoint to decide whether to create first value now or come back after daily work.
        - generic [ref=e416]:
          - generic [ref=e417]:
            - paragraph [ref=e418]: Progress percentage
            - paragraph [ref=e419]: 100%
          - generic [ref=e422]:
            - generic [ref=e423]:
              - paragraph [ref=e424]: Completed steps
              - paragraph [ref=e425]: Workspace identity, Business structure and master data, Team coverage, First saving card, Reporting and dashboard
            - generic [ref=e426]:
              - paragraph [ref=e427]: Remaining blockers
              - paragraph [ref=e428]: No first-value blockers remain.
            - generic [ref=e429]:
              - link "Open dashboard" [ref=e430] [cursor=pointer]:
                - /url: /dashboard
              - link "Continue later" [ref=e431] [cursor=pointer]:
                - /url: /dashboard
  - alert [ref=e432]
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | 
  3   | import { loginAs, logout } from "./support/auth";
  4   | import { personas } from "./support/personas";
  5   | import { installRuntimeWatchdog } from "./support/runtime-watchdog";
  6   | 
  7   | const publicRoutes = [
  8   |   {
  9   |     path: "/",
  10  |     expected: "Finance-trusted savings governance for US manufacturing SMEs.",
  11  |   },
  12  |   {
  13  |     path: "/pilot",
  14  |     expected: "Request a guided Traxium paid pilot",
  15  |   },
  16  |   {
  17  |     path: "/trust",
  18  |     expected: "Trust & security for guided pilots",
  19  |   },
  20  |   {
  21  |     path: "/login",
  22  |     expected: "Sign in to Traxium",
  23  |   },
  24  |   {
  25  |     path: "/forgot-password",
  26  |     expected: "Reset your password",
  27  |   },
  28  | ] as const;
  29  | 
  30  | const protectedRoutes = [
  31  |   { path: "/dashboard", heading: "Dashboard" },
  32  |   { path: "/saving-cards", heading: "Saving Cards" },
  33  |   { path: "/saving-cards/new", heading: "New Saving Card" },
  34  |   { path: "/kanban", heading: "Kanban Board" },
  35  |   { path: "/open-actions", heading: "Open Actions" },
  36  |   { path: "/command-center", heading: "Command Center" },
  37  |   { path: "/timeline", heading: "Timeline" },
  38  |   { path: "/reports", heading: "Reports" },
  39  |   { path: "/admin/members", heading: "Members" },
  40  |   { path: "/admin/settings", heading: "Workspace Settings" },
  41  |   { path: "/settings/billing", heading: "Workspace billing" },
  42  | ] as const;
  43  | 
  44  | test("public primary routes render without runtime failures", async ({ page }) => {
  45  |   const watchdog = installRuntimeWatchdog(page);
  46  | 
  47  |   for (const route of publicRoutes) {
  48  |     const response = await page.goto(route.path);
  49  |     expect(response?.status(), `${route.path} returned an unexpected status`).toBe(
  50  |       200
  51  |     );
  52  |     await expect(page.getByText(route.expected, { exact: false })).toBeVisible();
  53  |     await watchdog.checkpoint(route.path);
  54  |   }
  55  | 
  56  |   await page.goto("/request-demo");
  57  |   await expect(page).toHaveURL(/\/pilot$/);
  58  |   await expect(
  59  |     page.getByRole("heading", { name: "Request a guided Traxium paid pilot" })
  60  |   ).toBeVisible();
  61  |   await watchdog.checkpoint("/request-demo intended redirect");
  62  | });
  63  | 
  64  | test("owner can render every protected primary route cleanly", async ({ page }) => {
  65  |   test.setTimeout(300_000);
  66  |   const watchdog = installRuntimeWatchdog(page);
  67  |   await loginAs(page, personas.owner);
  68  |   await watchdog.checkpoint("owner login");
  69  | 
  70  |   for (const route of protectedRoutes) {
  71  |     const response = await page.goto(route.path);
  72  |     expect(response?.status(), `${route.path} returned an unexpected status`).toBe(
  73  |       200
  74  |     );
  75  |     await expect(
  76  |       page.getByRole("heading", { name: route.heading, exact: true }).last()
  77  |     ).toBeVisible();
  78  |     await expect(page).toHaveURL(new RegExp(`${route.path.replaceAll("/", "\\/")}$`));
  79  |     await watchdog.checkpoint(route.path);
  80  |   }
  81  | 
  82  |   const onboardingResponse = await page.goto("/onboarding");
  83  |   expect(onboardingResponse?.status()).toBe(200);
  84  |   await expect(page).toHaveURL(/\/onboarding$/);
  85  |   await expect(
  86  |     page.getByRole("heading", {
  87  |       name: "Set up UtopiaTrax for first value",
  88  |       exact: true,
  89  |     })
  90  |   ).toBeVisible();
  91  |   await expect(
  92  |     page.getByRole("link", { name: "Create first saving card", exact: true }).first()
  93  |   ).toBeVisible();
  94  |   await watchdog.checkpoint("/onboarding");
  95  | 
> 96  |   await page.getByRole("link", { name: "Saving Cards", exact: true }).click();
      |                                                                       ^ Error: locator.click: Test timeout of 300000ms exceeded.
  97  |   await expect(page).toHaveURL(/\/saving-cards$/);
  98  |   await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  99  |   await expect(page).toHaveURL(/\/dashboard$/);
  100 |   await watchdog.checkpoint("client-side primary navigation");
  101 | });
  102 | 
  103 | test("logout clears the session and protected routes redirect to login", async ({
  104 |   page,
  105 | }) => {
  106 |   const watchdog = installRuntimeWatchdog(page, {
  107 |     allowedAbortedGetPaths: ["/api/pending-approvals"],
  108 |   });
  109 |   await loginAs(page, personas.owner);
  110 |   await logout(page);
  111 |   await expect(page.getByText("Sign in to Traxium")).toBeVisible();
  112 | 
  113 |   await page.goto("/dashboard");
  114 |   await expect(page).toHaveURL(/\/login(?:\?|$)/);
  115 |   await watchdog.checkpoint("logout and protected redirect");
  116 | });
  117 | 
```