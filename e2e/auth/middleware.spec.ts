import { test, expect } from '@playwright/test'

test.describe('Auth Middleware Redirects', () => {
  test('dashboard redirects to login with redirect param', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/)
  })

  test('settings redirects to login with redirect param', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fsettings/)
  })

  test('history redirects to login with redirect param', async ({ page }) => {
    await page.goto('/history')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fhistory/)
  })

  test('public pages do not redirect', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/')

    await page.goto('/blindspot')
    await expect(page).toHaveURL('/blindspot')

    await page.goto('/sources')
    await expect(page).toHaveURL('/sources')
  })

  test('redirect param preserved on login page', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/)

    // Verify the login form is shown
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
  })
})
