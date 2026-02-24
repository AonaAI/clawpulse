# Security Guide

## Environment Variables

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client | Supabase project URL (safe to expose) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Supabase anon key (safe with RLS enabled) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Bypasses RLS — **never** prefix with `NEXT_PUBLIC_` |
| `SUPABASE_DB_PASSWORD` | Server only | Direct DB password for migration scripts |
| `SUPABASE_PROJECT_REF` | Server only | Project reference ID |

### Rules

- **Never commit `.env.local`** — it is gitignored.
- **Never prefix secrets with `NEXT_PUBLIC_`** — Next.js inlines these into the client bundle.
- Use `.env.example` as a template with placeholder values only.

## Supabase Row-Level Security (RLS)

All tables have RLS enabled. Current policy:

- **SELECT**: Open to anon/authenticated on most tables (dashboard is read-heavy).
- **INSERT/UPDATE/DELETE**: Restricted to `authenticated` or `service_role` depending on table.
- **`user_roles`**: Only admins can write; authenticated can read their own role.
- **`company_settings`**: Currently allows anon update — tighten to `authenticated` if auth is enforced.

### Recommendations for Production

1. Restrict all SELECT policies to `authenticated` if the dashboard requires login.
2. Restrict `spawn_requests` INSERT to `authenticated`.
3. Restrict `company_settings` UPDATE to `authenticated` with admin check.

## Auth & RBAC

- Auth is handled by Supabase Auth (email/password + magic link).
- RBAC is enforced client-side via `RBACProvider` using the `user_roles` table.
- Default role for new users: `viewer` (read-only).
- DEV role switcher is gated behind `NEXT_PUBLIC_DEV_MODE=true` **and** the user being an admin. Do not set this in production.

## Deployment

- Firebase Hosting serves the static export from `/out`.
- Source maps (`.map` files) are excluded from deployment via `firebase.json`.
- No server-side endpoints are exposed — all data flows through Supabase client SDK + RLS.

## Key Rotation

If secrets were ever exposed (e.g., in git history), rotate immediately:

1. **Supabase anon key / service role key**: Supabase Dashboard → Settings → API → Regenerate keys.
2. **DB password**: Supabase Dashboard → Settings → Database → Reset password.
3. **JWT secret**: Supabase Dashboard → Settings → API → JWT Settings.

After rotation, update `.env.local` and redeploy.
