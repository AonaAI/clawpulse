# E2E Tests (Playwright)

## Setup

```bash
npm install -D @playwright/test
npx playwright install chromium
```

## Running

```bash
# Run all tests (starts dev server automatically)
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui

# Against a deployed URL
PLAYWRIGHT_BASE_URL=https://your-app.web.app npm run test:e2e
```

## Authenticated Tests

Some tests require a valid Supabase user. Set env vars:

```bash
E2E_EMAIL=test@example.com E2E_PASSWORD=secret npm run test:e2e
```

Without these, authenticated tests are automatically skipped.

## RBAC Tests

RBAC tests additionally require:
- The test user to have **admin** role in the `user_roles` table
- `NEXT_PUBLIC_DEV_MODE=true` on the target app (enables localStorage role override)

## CI

Tests run in GitHub Actions on push to `main` and on PRs. Set `E2E_EMAIL` and `E2E_PASSWORD` as repository secrets to enable authenticated tests in CI.
