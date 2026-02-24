# Security Review — 2026-02-24

Review performed for making the repo public and publishing to ClawHub.

## Findings & Fixes

### 🔴 CRITICAL — Hardcoded Secrets in Source Files

**Found**: Service role key, DB password, and project ref hardcoded in:
- `scripts/seed-knowledge.mjs` — service role JWT
- `create_tables.mjs` — DB password + project ref
- `migrate_projects.mjs` — DB password + project ref
- `migrate_013_mission_hierarchy.mjs` — DB password + project ref

**Fixed**: All replaced with `process.env.*` reads. Scripts now require `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_REF` env vars.

### 🔴 CRITICAL — Service Role Key Exposed Client-Side

**Found**: `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and used in `lib/supabase-admin.ts` (imported by `app/settings/PageClient.tsx`). The `NEXT_PUBLIC_` prefix causes Next.js to bundle it into client JavaScript.

**Fixed**:
- `lib/supabase-admin.ts` now reads `SUPABASE_SERVICE_ROLE_KEY` (no prefix) and throws if imported client-side.
- `app/settings/PageClient.tsx` no longer imports supabase-admin. Admin user management (invite/delete/list) is stubbed — needs a server endpoint.
- `scripts/setup-roles.mjs` no longer falls back to `NEXT_PUBLIC_` variant.

### 🟡 HIGH — Secrets in Git History

**Found**: The hardcoded secrets above were committed in prior commits. Even though they're removed now, they remain in git history.

**Action required (human)**:
1. **Rotate all Supabase credentials** before making the repo public:
   - Supabase Dashboard → Settings → API → Regenerate anon + service role keys
   - Supabase Dashboard → Settings → Database → Reset DB password
2. Update `.env.local` with new credentials.
3. Optionally run `git filter-repo` to scrub history (or accept that rotation invalidates old keys).

### 🟡 HIGH — Project Ref in Documentation

**Found**: `CLAWPULSE-BRIEF.md`, `SETUP_DATABASE.md`, `SUPABASE_INTEGRATION_SUMMARY.md` contained the real Supabase project ref.

**Fixed**: Replaced with `YOUR_PROJECT_REF` placeholder.

### 🟢 LOW — Source Maps Deployed to Firebase

**Found**: `.map` files in `out/_next/static/chunks/` were deployed to Firebase Hosting.

**Fixed**: Added `"**/*.map"` to `firebase.json` ignore list.

### 🟢 LOW — `out/` Not Explicitly Gitignored

**Fixed**: Added `/out` to `.gitignore`.

### ✅ OK — DEV Role Switcher

Gated behind `NEXT_PUBLIC_DEV_MODE=true` AND admin role. Safe — won't appear unless explicitly enabled.

### ✅ OK — RLS Policies

All tables have RLS enabled. Policies are permissive for SELECT (appropriate for a dashboard). Write policies are appropriately scoped. Note: `company_settings` allows anon UPDATE — consider tightening if auth is enforced.

### ✅ OK — Firebase Hosting Config

No admin endpoints exposed. Clean rewrites only for SPA routing.

### ✅ OK — SKILL.md / ClawHub Metadata

Only requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe to expose). Does not instruct users to expose service role key.

### ✅ OK — `.env*` in `.gitignore`

`.env*` pattern is present in `.gitignore`. No env files are tracked in git.

## New Files

- `SECURITY.md` — Security guide for contributors/deployers.
- `SECURITY_REVIEW.md` — This file.

## Action Items for Human

1. **MUST**: Rotate Supabase keys + DB password before making repo public.
2. **SHOULD**: Remove `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` from `.env.local` (no longer used).
3. **SHOULD**: Implement server-side admin API for settings page user management (currently stubbed).
4. **CONSIDER**: Tighten RLS policies to require `authenticated` for all operations.
