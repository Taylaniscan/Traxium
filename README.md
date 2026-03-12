# Traxium

Traxium is a procurement savings tracker MVP built with Next.js, TypeScript, TailwindCSS, Prisma, Recharts, `dnd-kit`, and `xlsx`.

## What is included

- Dashboard with savings KPIs and charts
- Executive `Command Center` dashboard for procurement leadership
- Saving card CRUD with Zod validation
- Creatable master-data inputs for suppliers, materials, buyers, categories, plants, and business units
- Approval workflow and finance lock controls
- Local evidence upload with drag and drop, file validation, and upload progress
- Alternative supplier and alternative material scenario tracking on saving cards
- Kanban board with approval-gated phase movement
- Saving card project attributes for driver, implementation complexity, and qualification status
- Timeline view with portfolio filters
- Excel import and export
- Seeded demo data and mock notification feed

## Local setup

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Generate Prisma client with `npx prisma generate`.
4. Create the local SQLite database from the current Prisma schema:
   `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/init.sql`
   `sqlite3 prisma/dev.db < prisma/init.sql`
5. Seed demo data with `npm run db:seed`.
6. Start the app with `npm run dev`.

## Creatable master data

- The saving card form supports selecting an existing supplier, material, buyer, category, plant, or business unit.
- The same fields also support typing a new name and pressing `Create ...`.
- When the card is saved, the backend automatically resolves the existing record or creates a new one and links it to the saving card.
- New buyers are created as `TACTICAL_BUYER` users with an auto-generated `@traxium.local` email address.
- New plants are created with region `Global` for the MVP.

## Alternative sourcing fields

- The `Ownership & Scope` section includes an `Alternative sourcing involved` toggle.
- When enabled, optional `Alternative Supplier` and `Alternative Material` fields appear in the saving card form.
- Both fields support existing record selection or inline creation through the same creatable-select pattern used for the baseline master data.
- The saving card persists:
  `alternativeSupplierId`, `alternativeSupplierManualName`, `alternativeMaterialId`, and `alternativeMaterialManualName`.
- These fields are used for sourcing scenario documentation and savings justification. Baseline savings calculations still reference the baseline supplier, baseline material, baseline price, and new price entered on the card.
- On the saving card detail page, baseline and alternative sourcing values are shown together so buyers and finance can compare the scenario basis quickly.

## Project attributes

- Saving cards now support three optional project attributes:
  `savingDriver`, `implementationComplexity`, and `qualificationStatus`.
- These fields are available in the create/edit form under `Project Attributes`.
- The same attributes are displayed on the saving card detail page and surfaced on Kanban cards as visual badges.
- The dashboard supports filtering by all three attributes and includes dedicated charts for:
  `Savings by Driver`, `Savings by Complexity`, and `Savings by Qualification Status`.
- Existing cards remain valid; unset attributes are stored as `NULL` and displayed as `Not set` or omitted where appropriate.

## Evidence uploads

- Evidence uploads are handled by `POST /api/upload/evidence`.
- Files are stored locally for the MVP in `public/uploads/evidence`.
- Supported file types: PDF, JPG, JPEG, PNG, XLS, XLSX, DOC, DOCX, PPT, PPTX.
- Maximum file size: 25 MB per file.
- The saving card form supports drag-and-drop upload, file picker upload, multiple files, upload progress, file preview, and delete.
- Uploaded evidence metadata is persisted on the saving card in `SavingCardEvidence` with:
  `fileName`, `fileUrl`, `fileSize`, `fileType`, `uploadedById`, `uploadedAt`.
- The `Upload from Google Drive` button is an MVP placeholder and currently shows a future-integration message only.

## Alternative suppliers and materials

- Each saving card detail page now contains dedicated tabs for:
  `Alternative Suppliers` and `Alternative Materials`.
- Alternative supplier entries capture:
  supplier, country, quoted price, currency, lead time, MOQ, payment terms, quality rating, risk level, notes, and selected status.
- Alternative material entries capture:
  material, supplier, specification, quoted price, currency, performance impact, qualification status, risk level, notes, and selected status.
- Supplier and material fields in these tabs support:
  selecting existing master data or creating new entries inline.
- Marking an alternative supplier as selected updates the saving card's winning supplier and `newPrice`, then recalculates savings.
- Marking an alternative material as selected updates the saving card's winning material and optional supplier, updates `newPrice`, and recalculates savings.
- The detail page also includes a `Sourcing Scenario Comparison` widget that compares the baseline against alternative supplier and material prices and highlights the best price option.

## Kanban phase-change approvals

- Cards can be dragged between Kanban columns, but the move does not update the phase immediately.
- Dropping a card into a different phase opens a `Phase Change Approval` modal that shows the current phase, requested phase, required approvers, and an optional comment field.
- Submitting the modal creates a `PhaseChangeRequest` plus per-approver pending approval records.
- While approvals are pending, the card stays in its original column and shows an `Approval Pending` badge.
- Once all required approvers approve the request, the saving card phase is updated automatically and phase history is recorded.
- Cancelling a card requires a cancellation reason in the request modal.

## Demo users

- `sophie@traxium.local` — Head of Global Procurement
- `marco@traxium.local` — Financial Controller
- `jana@traxium.local` — Global Category Leader
- `luca@traxium.local` — Tactical Buyer
- `elena@traxium.local` — Procurement Analyst

## Notes

- The UI uses a neutral enterprise design system built around `Inter`, a blue/gray palette, compact cards, and dense but readable tables for procurement and finance workflows.
- Number formatting is consistent across KPIs, charts, tables, Kanban cards, and financial sections:
  values are abbreviated with `k` and `M`, and currencies render as values such as `EUR 2.4M` or `USD 350k` via the shared formatter.
- The `Command Center` page at `/command-center` provides a high-level executive view with KPI cards, phase pipeline, forecast, supplier exposure, benchmark opportunities, and validation/risk charts. Its filters update the dashboard through an aggregated API response rather than full-record dashboard loads.
- The MVP runs locally with SQLite for frictionless startup in this workspace. The Prisma schema can be switched to PostgreSQL by changing the datasource provider and `DATABASE_URL`.
- Excel import expects column headers such as `Title`, `Supplier`, `Material`, `Category`, `Plant`, `BusinessUnit`, `Buyer`, `BaselinePrice`, `NewPrice`, `AnnualVolume`, `Currency`, `FxRate`, `Frequency`, `StartDate`, and `EndDate`.
# Traxium
# Traxium
# Traxium
