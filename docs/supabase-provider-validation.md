# Supabase Provider Validation

This document records the Step 31 validation contract for Supabase Auth and Storage. The local app tests prove route behavior, tenant checks, and URL construction; this provider check proves the configured Supabase project matches the app contract where the provider exposes enough read-only evidence.

For release signoff, use [provider-flow-validation.md](/Users/atlas/Documents/Traxium/docs/provider-flow-validation.md) as the master Gap 1 checklist. This Supabase-specific document remains the detailed reference for Auth, redirect allow-list, private Storage, signed URL, and anon/public evidence-denial proof.

## Read-Only Provider Check

Run from a local or preview environment configured with non-production Supabase values:

```bash
npm run supabase:validate
```

The script is read-only. It does not create users, send emails, upload evidence, change buckets, or modify database rows.

It checks:

- `NEXT_PUBLIC_SUPABASE_URL`, anon key, and service-role key project/role alignment.
- Service-role Auth Admin read reachability without printing user emails.
- The configured evidence bucket exists.
- The evidence bucket is private (`public: false`).
- At least one existing evidence row uses the managed storage path format.
- Existing evidence metadata remains tied to a saving card and organization-owned managed path.
- Service-role storage can create a 60-second signed URL for an existing evidence object.
- The signed URL is reachable with `HEAD`.
- The anon key cannot create a signed URL for the same evidence object.
- The anon key cannot download the same evidence object directly.
- The unauthenticated public storage URL is not readable.
- Application exports expose evidence coverage metadata only, never provider paths or signed URLs.

Expected result:

- All storage/auth read checks should pass.
- `auth_redirect_allow_list` is expected to be `blocked` unless a Supabase Management API token or dashboard screenshot is used, because anon and service-role application keys cannot read the Auth URL allow-list.

## Supabase Dashboard Checks

Record these checks for preview before paid-pilot release:

1. Open the Supabase project used by the preview deployment.
2. Confirm the project ref matches `NEXT_PUBLIC_SUPABASE_URL`.
3. Confirm Auth Site URL matches `NEXT_PUBLIC_APP_URL`.
4. Confirm redirect URLs include:
   - `${NEXT_PUBLIC_APP_URL}/invite/*`
   - `${NEXT_PUBLIC_APP_URL}/reset-password`
   - `${NEXT_PUBLIC_APP_URL}/auth/bootstrap`
5. Confirm email templates or hosted Auth emails do not point at stale localhost or production URLs in preview.
6. Confirm password recovery links land on `/reset-password`.
7. Confirm new-user invitation links land on `/invite/{token}?mode=setup`.
8. Confirm existing-user invitation or magic-link accept flow lands on `/invite/{token}?mode=accept`.
9. Confirm the `evidence-private` bucket, or the bucket named by `SUPABASE_STORAGE_BUCKET`, is private.
10. Confirm no public bucket policy allows unauthenticated evidence reads.
11. Download showcase evidence through `/api/evidence/{id}/download` and record the 60-second TTL without recording the URL.
12. Confirm `/admin/settings` shows the organization-scoped evidence download audit event.
13. Confirm `/reports` and export show evidence coverage metadata but no storage path, signed URL, or token.

## Local Automated Coverage

Relevant automated tests:

- `tests/api/password-recovery.test.ts`
- `tests/api/invitations.test.ts`
- `tests/api/invitation-acceptance.test.ts`
- `tests/api/invitation-account-setup.test.ts`
- `tests/api/storage-tenant-access.test.ts`
- `tests/api/import-and-evidence.route.test.ts`
- `tests/middleware.auth-routing.test.ts`
- `tests/lib/env-config.test.ts`
- `tests/lib/auth-guards.test.ts`

These prove app-side behavior, not provider dashboard settings.

## Result Interpretation

- If `private_evidence_bucket` fails, create or correct the private Supabase Storage bucket before demos or pilots.
- If any anon evidence check fails, remove the public/read policy before handling buyer evidence.
- If service-role signed URL creation fails, verify `SUPABASE_SERVICE_ROLE_KEY`, bucket name, storage object existence, and service-role storage permissions.
- If only `auth_redirect_allow_list` is blocked, finish the dashboard checks above before calling Step 31 fully provider-proven.
