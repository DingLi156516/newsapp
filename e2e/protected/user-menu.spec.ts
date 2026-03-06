import { test, expect } from '@playwright/test'

test.describe('User Menu (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('avatar button is visible instead of Sign In', async ({ page }) => {
    await expect(page.getByTestId('user-menu-trigger')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Sign In')).not.toBeVisible()
  })

  test('dropdown opens on click with email displayed', async ({ page }) => {
    await page.getByTestId('user-menu-trigger').click()

    const dropdown = page.getByTestId('user-menu-dropdown')
    await expect(dropdown).toBeVisible()

    // Should show user email
    await expect(dropdown.locator('p')).toBeVisible()
  })

  test('navigation links work - History', async ({ page }) => {
    await page.getByTestId('user-menu-trigger').click()
    await page.getByRole('button', { name: 'History' }).click()
    await expect(page).toHaveURL('/history')
  })

  test('navigation links work - Dashboard', async ({ page }) => {
    await page.getByTestId('user-menu-trigger').click()
    await page.getByRole('button', { name: 'Dashboard' }).click()
    await expect(page).toHaveURL('/dashboard')
  })

  test('navigation links work - Settings', async ({ page }) => {
    await page.getByTestId('user-menu-trigger').click()
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page).toHaveURL('/settings')
  })

  test('dropdown closes on outside click', async ({ page }) => {
    await page.getByTestId('user-menu-trigger').click()
    await expect(page.getByTestId('user-menu-dropdown')).toBeVisible()

    // Click outside the menu
    await page.locator('body').click({ position: { x: 10, y: 10 } })
    await expect(page.getByTestId('user-menu-dropdown')).not.toBeVisible()
  })
})
