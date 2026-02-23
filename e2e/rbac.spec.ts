import { test, expect } from '@playwright/test'

/**
 * RBAC E2E tests for ClawPulse.
 *
 * ClawPulse uses client-side RBAC via RBACProvider + RouteGuard.
 * In DEV_MODE (NEXT_PUBLIC_DEV_MODE=true), admin users can override
 * their role via localStorage key 'clawpulse-role-dev'.
 *
 * These tests require:
 *   - E2E_EMAIL / E2E_PASSWORD for an admin user
 *   - NEXT_PUBLIC_DEV_MODE=true on the target app
 *
 * The test logs in as admin, then overrides the role via localStorage
 * to simulate viewer/operator restrictions.
 */

const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const canRun = !!(email && password)

const authTest = test.extend<{ authedPage: import('@playwright/test').Page }>({
  authedPage: async ({ page }, use) => {
    await page.goto('/login')
    await page.locator('#email').fill(email!)
    await page.locator('#password').fill(password!)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })
    await use(page)
  },
})

const describeRbac = canRun ? test.describe : test.describe.skip

describeRbac('RBAC — role-based route guarding', () => {
  authTest('viewer is redirected from /settings with toast', async ({ authedPage: page }) => {
    // Override role to viewer
    await page.evaluate(() => localStorage.setItem('clawpulse-role-dev', 'viewer'))
    await page.goto('/settings')

    // RouteGuard should redirect to home
    await expect(page).toHaveURL(/^\/$/, { timeout: 10_000 })

    // Toast should appear
    const toast = page.locator('text=Access restricted')
    await expect(toast).toBeVisible({ timeout: 5_000 })
  })

  authTest('viewer is redirected from /tasks', async ({ authedPage: page }) => {
    await page.evaluate(() => localStorage.setItem('clawpulse-role-dev', 'viewer'))
    await page.goto('/tasks')

    await expect(page).toHaveURL(/^\/$/, { timeout: 10_000 })
    const toast = page.locator('text=Access restricted')
    await expect(toast).toBeVisible({ timeout: 5_000 })
  })

  authTest('admin can access /settings', async ({ authedPage: page }) => {
    // Ensure role is admin (clear any override)
    await page.evaluate(() => localStorage.removeItem('clawpulse-role-dev'))
    await page.goto('/settings')

    await expect(page).toHaveURL(/\/settings/, { timeout: 10_000 })
  })

  authTest('operator can access /tasks but not /settings', async ({ authedPage: page }) => {
    await page.evaluate(() => localStorage.setItem('clawpulse-role-dev', 'operator'))

    await page.goto('/tasks')
    await expect(page).toHaveURL(/\/tasks/, { timeout: 10_000 })

    await page.goto('/settings')
    await expect(page).toHaveURL(/^\/$/, { timeout: 10_000 })
  })
})
