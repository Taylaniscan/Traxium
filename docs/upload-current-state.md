# Upload Current State

## Current flow
- Upload trigger:
- API route:
- Helper/service:
- Storage provider:
- Bucket name:
- DB fields stored:
- Public URL generated?: Yes/No

## Risks
- Public file exposure:
- Missing authz:
- Missing validation:
- Missing audit logging:

## Target state
- Private bucket
- Store bucket + storagePath only
- Signed download route
- Authenticated access only
- File validation and size limits