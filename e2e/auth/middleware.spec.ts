import { test, expect } from '@playwright/test'

test.describe('Auth Middleware Redirects', () => {
  test('dashboard redirects to login with redirect param', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login\?redirect=.*dashboard/)
  })

  test('settings redirects to login with redirect param', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/login\?redirect=.*settings/)
  })

  test('history redirects to login with redirect param', async ({ page }) => {
    await page.goto('/history')
    await expect(page).toHaveURL(/\/login\?redirect=.*history/)
  })

  test('public pages do not redirect', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/')

    await page.goto('/blindspot')
    await expect(page).toHaveURL('/blindspot')

    await page.goto('/sources')
    await expect(page).toHaveURL('/?view=sources')
  })

  test('redirect param preserved on login page', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login\?redirect=.*dashboard/)

    // Verify the login form is shown
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
  })
})
