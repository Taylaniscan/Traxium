# Upload Current State

## Current flow
- Upload trigger: `EvidenceUploader` uploads each file in three steps, because Vercel functions reject request bodies over 4.5 MB while evidence files may be up to 25 MB:
  1. `POST /api/upload/evidence/sign` (JSON metadata only) authenticates, rate-limits, validates name/size/type, checks saving-card access and upload quota, then returns a one-time signed upload URL for a server-chosen path under the tenant/card prefix.
  2. The browser `PUT`s the file bytes directly to that signed URL in the private bucket. The URL is valid for one object path, cannot overwrite an existing object, and carries no reusable credentials.
  3. `POST /api/upload/evidence/complete` re-checks access, verifies the path belongs to the card's tenant namespace, reads the stored object's real size and content type from storage, deletes the object if it fails the size/type policy or quota, and only then creates the evidence row, audit event, and usage event.
- API routes: `app/api/upload/evidence/sign/route.ts`, `app/api/upload/evidence/complete/route.ts`, and `app/api/evidence/[id]/download/route.ts` (download). The original multipart `app/api/upload/evidence/route.ts` remains for small files and scripts; on Vercel it only accepts bodies under 4.5 MB.
- Helper/service: `lib/uploads.ts` stores files with the Supabase service-role server client and creates short-lived signed URLs.
- Storage provider: Supabase Storage, private bucket.
- Bucket name: `SUPABASE_STORAGE_BUCKET` or `evidence-private` by default.
- DB fields stored: `storageBucket`, `storagePath`, `fileName`, `fileSize`, `fileType`, `uploadedById`.
- Storage path format for new uploads: `organizations/{organizationId}/saving-cards/{savingCardId}/evidence/{generatedFileName}`.
- Public URL generated?: No. Downloads stay server-mediated and redirect only to short-lived signed URLs after authorization passes.

## Risks
- Public file exposure: mitigated. Active code does not generate public URLs.
- Missing authz: reduced. Upload and download require an authenticated user, enforce saving-card tenant ownership, and return `404` for inaccessible evidence.
- Missing validation: file extension and size are validated before upload; download additionally validates bucket/path shape before signing.
- Missing audit logging: upload and download are both audit logged.

## Notes
- Global procurement/finance roles may bypass participant checks, but never tenant boundaries.
- Seeded evidence rows now use the same organization-scoped storage path convention as runtime uploads.
- Signed URLs are created server-side with the service-role client; the browser never receives direct storage credentials. A signed upload URL can write only its single pre-chosen object path.
- A signed upload that is never completed can leave an unreferenced object in the bucket; it is never exposed because no evidence row points to it.
