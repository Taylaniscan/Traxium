# Guided onboarding

Traxium introduces a new workspace in six short steps:

1. **Your workspace:** name the workspace and confirm optional regional preferences.
2. **Your team:** add the first buyer, the named owner of a saving card. Workspace owners and admins can invite colleagues from this screen. Invited colleagues join as members or admins. Workspace access and finance approval permissions are separate.
3. **Your materials:** add a material, part, or service by name.
4. **Your suppliers:** add a current supplier by name.
5. **Your categories:** add a category for reporting.
6. **First saving card:** open the existing card creation workflow with the shared records now available for selection. The card captures prices, annual volume, currency, and evidence. Finance approval remains a separate governed action.

Each record step shows the count already present in the active workspace and offers a small inline form. The existing tenant-scoped onboarding API handles validation, duplicate detection, rate limiting, and writes. For larger sets, spreadsheet templates and import remain available behind the existing permission checks. A user can skip a step, revisit it, or create a card immediately. Skipped steps are shown as unfilled in the progress indicator.

Wizard position is saved only in the browser session, scoped by workspace ID. Real records are persisted through the existing services. On a new session, Traxium suggests the first incomplete step based on saved record counts. Returning workspaces that already have saving cards open at the final step with a dashboard link.

The team invitation form calls the existing invitation service only after the owner or admin clicks **Create invitation**. If delivery needs a manual handoff, the wizard shows the invitation link. Other members can see guidance but cannot create invitations or shared records without permission. Server checks remain authoritative.

Regional preferences change display formats, time zone, and suggested units. Financial currency is configured separately in workspace settings. The interface remains in English. The redesign needs no database migration and does not change approval, finance lock, tenant, or billing rules.
