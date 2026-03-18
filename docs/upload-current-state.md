# Upload Current State

## Current flow
- Upload trigger: `EvidenceUploader` posts multipart form data to `/api/upload/evidence`.
- API routes: `app/api/upload/evidence/route.ts` handles upload and `app/api/evidence/[id]/download/route.ts` handles download.
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
- Signed URLs are created server-side with the service-role client; the browser never receives direct storage credentials.
