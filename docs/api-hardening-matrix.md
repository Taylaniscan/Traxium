# API Hardening Matrix

| Route | Method | Purpose | Auth Required | Role Check | Input Validation | Data Scope Check | Error Shape | Audit Log | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| /api/saving-cards | GET | List saving cards | Unknown | Unknown | N/A | Unknown | Unknown | No | TODO |  |
| /api/saving-cards | POST | Create saving card | Unknown | Unknown | Unknown | Unknown | Unknown | No | TODO |  |
| /api/saving-cards/[id] | GET | Get single saving card | Unknown | Unknown | N/A | Unknown | Unknown | No | TODO |  |
| /api/saving-cards/[id] | PATCH/PUT | Update saving card | Unknown | Unknown | Unknown | Unknown | Unknown | No | TODO |  |
| /api/upload/evidence | POST | Upload evidence file | Yes | Partial | Partial | Partial | Partial | No | IN PROGRESS | Requires auth, checks savingCard access via buyer/stakeholder/approver or global role, validates savingCardId and files presence, but has no audit log and no standardized error envelope |
| /api/evidence/[id]/download | GET | Download evidence via signed URL | Yes | Partial | Partial | Partial | Partial | No | IN PROGRESS | Requires auth, checks evidence access via related saving card ownership/stakeholder/approver or global role, returns signed URL redirect, but has no audit log and no standardized error envelope |
| /api/import | POST | Import data | Unknown | Unknown | Unknown | Unknown | Unknown | No | TODO |  |
| /api/export | GET/POST | Export data | Unknown | Unknown | Unknown | Unknown | Unknown | No | TODO |  |
| /api/pending-approvals | GET | Approval queue | Unknown | Unknown | N/A | Unknown | Unknown | No | TODO |  |
| /api/command-center/* | GET/POST | Command center data/actions | Unknown | Unknown | Unknown | Unknown | Unknown | No | TODO |  |
| /api/open-actions/* | GET/POST | Open actions | Unknown | Unknown | Unknown | Unknown | Unknown | No | TODO |  |
| /api/admin/* | GET/POST | Admin/reference data | Unknown | Unknown | Unknown | Unknown | Unknown | No | TODO |  |
