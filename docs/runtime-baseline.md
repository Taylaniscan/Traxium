# Runtime Baseline

## Current branch
- harden/pr1-auth

## Build
- [x] npm install
- [x] npm run db:generate
- [x] npm run build

## Local smoke test
- [x] Login page opens
- [x] Login succeeds
- [x] Dashboard opens
- [x] Saving cards list loads
- [x] Saving card detail opens
- [ ] Saving card create works
- [ ] Evidence upload works
- [ ] Export works
- [ ] Admin/reference data opens

## Known issues
- Supabase env mismatch caused login/runtime failures; fixed locally
- Prisma DB connection required direct connection correction

## Env source of truth
- .env.local = local real values
- Vercel = preview/prod values

## Notes
- Login prerender issue fixed by deferring Supabase browser client creation
- Local auth, logout, dashboard, kanban, and saving cards are working