import { test, expect } from '@playwright/test'

test.describe('View Switcher', () => {
  test('direct navigation to /?view=sources renders sources view', async ({ page }) => {
    await page.goto('/?view=sources')
    await expect(page.getByTestId('view-tab-sources')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('Filter by Bias')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByPlaceholder('Search sources…')).toBeVisible()
  })

  test('/sources redirects to /?view=sources', async ({ page }) => {
    await page.goto('/sources')
    await expect(page).toHaveURL('/?view=sources')
    await expect(page.getByTestId('view-tab-sources')).toHaveAttribute('aria-selected', 'true')
  })

  test('feed-only UI is hidden in sources view', async ({ page }) => {
    await page.goto('/?view=sources')
    await expect(page.getByTestId('feed-tab-trending')).not.toBeVisible()
    // Header story search bar is not rendered; source search bar is shown instead
    await expect(page.getByPlaceholder('Search stories...')).not.toBeVisible()
  })

  test('feed-only UI is visible in feed view', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('feed-tab-trending')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByPlaceholder('Search stories...')).toBeVisible()
  })

  test('browser back button from sources view returns to feed', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('view-tab-sources').click()
    await expect(page).toHaveURL('/?view=sources')
    await page.goBack()
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('view-tab-feed')).toHaveAttribute('aria-selected', 'true')
  })

  test('sources view shows search bar for source search', async ({ page }) => {
    await page.goto('/?view=sources')
    await expect(page.getByPlaceholder('Search stories...')).not.toBeVisible()
    await expect(page.getByPlaceholder('Search sources…')).toBeVisible({ timeout: 5_000 })
  })
})
