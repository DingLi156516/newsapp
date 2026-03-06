import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
  })

  test('page loads with Bias Calibration heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Bias Calibration' })).toBeVisible()
  })

  test('banner shows descriptive text', async ({ page }) => {
    await expect(page.getByText(/reading habits shape your worldview/)).toBeVisible()
  })

  test('back button navigates to feed', async ({ page }) => {
    await page.getByRole('button', { name: 'Feed' }).click()
    await expect(page).toHaveURL('/')
  })

  test('user menu is visible (authenticated)', async ({ page }) => {
    await expect(page.getByTestId('user-menu-trigger')).toBeVisible()
  })

  test('shows spectrum comparison section', async ({ page }) => {
    // Wait for profile to load - either comparison or empty state
    const comparison = page.getByText('Spectrum Comparison')
    const emptyState = page.getByText('Start reading stories')

    await expect(comparison.or(emptyState)).toBeVisible({ timeout: 10_000 })
  })

  test('shows suggested stories section', async ({ page }) => {
    await expect(page.getByText('Suggested For You')).toBeVisible({ timeout: 10_000 })
  })

  test('empty state for fresh user with no history', async ({ page }) => {
    // If user has no reading history, should see empty state
    const emptyState = page.getByText('Start reading stories')
    const profileChart = page.getByText('Detailed Breakdown')

    // One of these should be visible depending on user's reading history
    await expect(emptyState.or(profileChart)).toBeVisible({ timeout: 10_000 })
  })
})
