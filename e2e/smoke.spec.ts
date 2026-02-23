import { test, expect } from '@playwright/test'

/**
 * Smoke tests for ClawPulse core flows.
 *
 * These tests run against an unauthenticated session by default.
 * Without valid Supabase credentials, the app redirects to /login.
 *
 * To run authenticated tests, set E2E_EMAIL and E2E_PASSWORD env vars
 * and use the "authenticated" tests below.
 */

// ---------------------------------------------------------------------------
// Unauthenticated: Login page loads
// ---------------------------------------------------------------------------

test.describe('unauthenticated', () => {
  test('redirects to login page', async ({ page }) => {
    await page.goto('/')
    // Auth redirect should land on /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
    await expect(page.getByText('Sign in to your account')).toBeVisible()
  })

  test('login page renders form fields', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Authenticated flows — require E2E_EMAIL + E2E_PASSWORD env vars
// ---------------------------------------------------------------------------

const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

const authTest = test.extend<{ authedPage: import('@playwright/test').Page }>({
  authedPage: async ({ page }, use) => {
    await page.goto('/login')
    await page.locator('#email').fill(email!)
    await page.locator('#password').fill(password!)
    await page.getByRole('button', { name: /sign in/i }).click()
    // Wait for redirect away from login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })
    await use(page)
  },
})

const describeAuth = email && password ? test.describe : test.describe.skip

describeAuth('authenticated', () => {
  authTest('loads home / dashboard', async ({ authedPage: page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/^\/$|\/(?!login)/)
    // Page should have main content (sidebar or heading)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  authTest('Cmd+K opens search / command palette', async ({ authedPage: page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Trigger Cmd+K (Meta+K on Mac, Control+K on Linux/Windows)
    await page.keyboard.press('Meta+k')
    // Should open a dialog or search input
    const dialog = page.locator('[role="dialog"], [data-testid="command-palette"]')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
  })

  authTest('navigates to /agents', async ({ authedPage: page }) => {
    await page.goto('/agents')
    await expect(page).toHaveURL(/\/agents/)
    await page.waitForLoadState('networkidle')
  })

  authTest('navigates to /metrics', async ({ authedPage: page }) => {
    await page.goto('/metrics')
    await expect(page).toHaveURL(/\/metrics/)
    await page.waitForLoadState('networkidle')
  })

  authTest('navigates to /sessions', async ({ authedPage: page }) => {
    await page.goto('/sessions')
    await expect(page).toHaveURL(/\/sessions/)
    await page.waitForLoadState('networkidle')
  })
})
