# DB Security Access Matrix

This document defines how tenant isolation is enforced in the current Traxium codebase after the 5.1, 5.2, and 5.3 hardening steps.

## Core Rules

1. Every organization-owned query must receive a `TenantContextSource`.
2. Route-level auth is not enough. Service and query code must scope data again.
3. `id`-only reads, updates, and deletes are not allowed for organization-owned resources.
4. Cross-tenant access failures must not reveal whether the foreign record exists.
5. Evidence files must live inside an organization-scoped storage namespace before a signed URL can be created.

## Helper Selection

| Need | Helper | File |
|---|---|---|
| Resolve active tenant from a user or organization id | `resolveTenantScope` | `lib/tenant-scope.ts` |
| Build `{ organizationId, ...where }` filters | `buildTenantScopeWhere` | `lib/tenant-scope.ts` |
| Scope child resources through a parent relation such as `savingCard` | `buildTenantOwnedRelationWhere` | `lib/tenant-scope.ts` |
| Check a loaded record belongs to the active tenant | `hasTenantOwnership` | `lib/tenant-scope.ts` |
| Scope user queries through memberships | `buildOrganizationUserWhere` | `lib/organizations.ts` |
| Resolve a volume card in a route before calling mutations | `resolveVolumeCardContext` | `app/api/saving-cards/[id]/volume/shared.ts` |
| Validate and namespace evidence storage paths | `isManagedEvidenceStorageLocation`, `storeEvidenceFile`, `createEvidenceSignedUrl` | `lib/uploads.ts` |

## Organization-Scoped Data Matrix

| Data Type | Scope Requirement | Current Enforcement |
|---|---|---|
| `SavingCard` | Must be filtered by `organizationId` | `lib/data.ts`, `lib/volume.ts` |
| `Buyer` | Must be filtered by `organizationId` | `lib/data.ts` |
| `Supplier` | Must be filtered by `organizationId` | `lib/data.ts` |
| `Material` | Must be filtered by `organizationId` | `lib/data.ts` |
| `Category` | Must be filtered by `organizationId` | `lib/data.ts` |
| `Plant` | Must be filtered by `organizationId` | `lib/data.ts` |
| `BusinessUnit` | Must be filtered by `organizationId` | `lib/data.ts` |
| `AnnualTarget` | Must be filtered by `organizationId` | `lib/data.ts` |
| `MaterialConsumptionForecast` | Must be scoped through owning `SavingCard` | `lib/volume.ts` |
| `MaterialConsumptionActual` | Must be scoped through owning `SavingCard` | `lib/volume.ts` |
| `SavingCardAlternativeSupplier` | Must be scoped through owning `SavingCard` | `lib/data.ts` |
| `SavingCardAlternativeMaterial` | Must be scoped through owning `SavingCard` | `lib/data.ts` |
| `PhaseChangeRequest` | Must be scoped through owning `SavingCard` | `lib/data.ts` |
| `PhaseChangeRequestApproval` | Must be scoped through `phaseChangeRequest.savingCard` | `lib/data.ts` |
| `SavingCardEvidence` metadata | Must be scoped through owning `SavingCard.organizationId` and evidence access rules | `app/api/evidence/[id]/download/route.ts`, `app/api/upload/evidence/route.ts` |
| `User` organization lists | Must be scoped through active memberships, not legacy org assumptions | `lib/organizations.ts`, `lib/data.ts` |

## Routes That Require Ownership Validation

| Route File | Resource | Required Check |
|---|---|---|
| `app/api/saving-cards/[id]/route.ts` | Saving card detail, update, finance lock | `getSavingCard(id, user.organizationId)` and tenant-scoped service calls |
| `app/api/saving-cards/[id]/volume/route.ts` | Volume timeline read | `resolveVolumeCardContext` and `getVolumeTimeline(id, context)` |
| `app/api/saving-cards/[id]/volume/forecast/route.ts` | Forecast create/delete | `resolveVolumeCardContext` and `upsertForecast` or `deleteForecast` with tenant context |
| `app/api/saving-cards/[id]/volume/actual/route.ts` | Actual create/delete | `resolveVolumeCardContext` and `upsertActual` or `deleteActual` with tenant context |
| `app/api/saving-cards/[id]/volume/import/route.ts` | Forecast/actual bulk import | `resolveVolumeCardContext` and `importFromCsv` with tenant context |
| `app/api/saving-cards/[id]/alternative-suppliers/[alternativeId]/route.ts` | Alternative supplier update/delete | `updateAlternativeSupplier` and `deleteAlternativeSupplier` must scope through `savingCard` ownership |
| `app/api/saving-cards/[id]/alternative-materials/[alternativeId]/route.ts` | Alternative material update/delete | `updateAlternativeMaterial` and `deleteAlternativeMaterial` must scope through `savingCard` ownership |
| `app/api/upload/evidence/route.ts` | Evidence upload | Saving card access must be validated before storing or creating metadata |
| `app/api/evidence/[id]/download/route.ts` | Evidence signed URL download | Evidence DB lookup, storage namespace validation, and signed URL generation must all agree on the same tenant |
| `app/api/export/route.ts` | Organization export | Export must pull cards and readiness through active tenant context, not raw unverified ids |

## File Access Rules

### Evidence Storage Namespace

Evidence files must use this exact structure:

```text
organizations/{sanitizedOrganizationId}/saving-cards/{sanitizedSavingCardId}/evidence/{sanitizedFileName}
```

Rules:

- Bucket must be `evidence-private` unless `SUPABASE_STORAGE_BUCKET` overrides it.
- `organizationId` and `savingCardId` must be sanitized path segments.
- Signed URL generation is rejected if the path contains `..`, `.`, `//`, backslashes, empty segments, or a different namespace shape.
- The database record does not grant access by itself. The route must still validate that the path belongs to the same organization and saving card.
- File name or path guessing must not create access.

### Current Enforcement Points

| Flow | Enforcement |
|---|---|
| Upload | `app/api/upload/evidence/route.ts` validates saving card access first, then `lib/uploads.ts` stores under the organization-scoped prefix |
| Download | `app/api/evidence/[id]/download/route.ts` validates evidence ownership from the DB and rejects paths that fail `isManagedEvidenceStorageLocation` |
| Signed URL | `lib/uploads.ts` only creates signed URLs for valid managed evidence paths |

## Error Handling Rules

Use information-safe responses for tenant-owned resources:

- Saving card detail or mutation failures: `"Saving card not found."`
- Evidence file failures: `"Evidence not found or access denied."`
- Alternative supplier or material failures: resource-specific not found message without exposing tenant mismatch

Do not return separate messages for:

- record exists but belongs to another organization
- record does not exist

## Development Checklist

When adding a new query or mutation:

1. Decide whether the resource is directly organization-owned or indirectly owned through another resource.
2. If direct, use `buildTenantScopeWhere(context, where)`.
3. If indirect, use `buildTenantOwnedRelationWhere("parentRelation", context, where)`.
4. If the route already resolved the current user, still pass tenant context into the service layer.
5. Do not use `findUnique({ where: { id } })`, `update({ where: { id } })`, or `delete({ where: { id } })` for tenant-owned resources unless the unique key itself already includes tenant ownership.
6. For file access, validate both the DB ownership and the storage namespace before creating a signed URL.
7. Add or update regression tests in the existing tenant-security suites.

## Regression Test Map

| Behavior | Test File |
|---|---|
| Tenant scope helper behavior | `tests/lib/tenant-scope.test.ts` |
| Membership-aware active tenant resolution | `tests/lib/membership-context.test.ts` |
| Cross-tenant query read, update, delete blocking | `tests/api/tenant-isolation-queries.test.ts` |
| Cross-tenant mutation blocking on related resources | `tests/api/tenant-scope-mutations.test.ts` |
| Cross-tenant file access blocking and same-tenant signed URL success | `tests/api/storage-tenant-access.test.ts` |

Keep this document aligned with `lib/tenant-scope.ts`, `lib/data.ts`, `lib/volume.ts`, `lib/uploads.ts`, and the route files listed above.
