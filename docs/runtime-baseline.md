# Runtime Baseline

## Current branch
- harden/pr1-auth

## Build
- [x] npm install
- [x] npm run db:generate
- [x] npm run build

## Local smoke test
- [ ] Login page opens
- [ ] Login succeeds
- [ ] Dashboard opens
- [ ] Saving cards list loads
- [ ] Saving card detail opens
- [ ] Saving card create works
- [ ] Evidence upload works
- [ ] Export works
- [ ] Admin/reference data opens

## Known issues
- 
- 

## Env source of truth
- .env.local = local real values
- Vercel = preview/prod values

## Notes
- Login prerender issue fixed by moving Supabase browser client creation into submit handler.
