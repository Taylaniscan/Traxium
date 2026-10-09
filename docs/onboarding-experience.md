# Onboarding experience

Traxium uses three short steps for a new workspace:

1. **Your workspace:** enter a workspace name. Regional preferences are suggested from the browser and can be changed before creation. An optional description is collapsed by default.
2. **Your starting point:** choose one real saving card, an existing spreadsheet, or sample cards. Selecting a path does not create data.
3. **Ready to track:** see a short preparation list and open the relevant workflow. Sample records are added only after clicking **Add sample cards**.

The workspace is saved in step 1. Returning with existing saving cards shows the dashboard handoff. Before adding a card, returning users can choose a starting path again; the temporary path selection is not stored. **Continue later** opens the dashboard.

## Optional setup

Team invitations, regional settings, and reference-data templates are in **Set up a little more**. Users can create required reference records inline while creating their first saving card. Invitations and workspace settings remain limited to owners/admins. Import options follow the existing workspace-management permission. The API remains authoritative for every mutation.

Regional preferences change display formats, time zone, and suggested units. Financial currency is configured separately in workspace settings. The interface remains in English.

## Safety and accessibility

- The existing workspace API, billing checks, tenant boundaries, approval workflow, and finance locks are unchanged.
- Sample cards are offered only when readiness is known and no cards exist. They are intended for demo/training workspaces. The sample-data service retains its server-side checks.
- Submission controls prevent duplicate requests and show recoverable errors.
- Starting paths use native radio controls; optional sections use native disclosure controls. Step transitions move keyboard focus to the main heading.
- If readiness cannot load, users can still open the real-card workflow. No guessed readiness status permits sample insertion.

No database migration or provider setup is required for this onboarding redesign.

## Verification (9 October 2026)

- `npm test`: 840 tests passed across 169 files.
- `npm run test:ci:smoke`: 4 tests passed.
- `npm run typecheck` and `npm run build`: passed.
- `npm run lint`: no errors; 35 existing repository warnings.
- Headless Chrome checks at desktop and mobile sizes covered browser regional suggestions, invalid preferences, duplicate workspace submission, recoverable API errors, all starting paths, keyboard selection, heading focus, member permissions, missing readiness, and returning workspaces. API writes were intercepted against a temporary local preview route; the route was removed afterward.

The database-backed end-to-end suite was updated but not executed: its global setup resets demo data and creates authentication users. These UI checks did not modify production data.
