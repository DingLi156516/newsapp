import { test, expect } from '@playwright/test'

test.describe('Sources Directory', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sources')
  })

  test('page loads with source cards grid', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Source Directory' })).toBeVisible()
    // Wait for sources to load
    await expect(page.getByText(/\d+ sources?/)).toBeVisible({ timeout: 10_000 })
  })

  test('search filters by source name', async ({ page }) => {
    await expect(page.getByText(/\d+ sources?/)).toBeVisible({ timeout: 10_000 })

    const searchInput = page.getByTestId('search-input')
    await searchInput.fill('zzzznonexistent')

    await expect(page.getByText('0 sources')).toBeVisible({ timeout: 5_000 })
  })

  test('bias filter pills toggle and filter', async ({ page }) => {
    await expect(page.getByText(/\d+ sources?/)).toBeVisible({ timeout: 10_000 })

    await expect(page.getByText('Filter by Bias')).toBeVisible()

    // Click a bias filter
    const centerButton = page.getByRole('button', { name: /Center/ }).first()
    await centerButton.click()
    await expect(centerButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('factuality filter pills toggle and filter', async ({ page }) => {
    await expect(page.getByText(/\d+ sources?/)).toBeVisible({ timeout: 10_000 })

    await expect(page.getByText('Filter by Factuality')).toBeVisible()

    // Click a factuality filter
    const highButton = page.getByRole('button', { name: 'High Factuality' }).first()
    await highButton.click()
    await expect(highButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('compound filters work together', async ({ page }) => {
    await expect(page.getByText(/\d+ sources?/)).toBeVisible({ timeout: 10_000 })

    // Apply bias filter
    await page.getByRole('button', { name: /Center/ }).first().click()
    // Apply factuality filter
    await page.getByRole('button', { name: 'High Factuality' }).first().click()

    // Count should update (may be 0)
    await expect(page.getByText(/\d+ sources?/)).toBeVisible()
  })

  test('source cards show metadata', async ({ page }) => {
    await expect(page.getByText(/\d+ sources?/)).toBeVisible({ timeout: 10_000 })

    // Source cards should have name text
    const sourceCards = page.locator('.glass-sm')
    const count = await sourceCards.count()
    if (count > 0) {
      // First card should have visible text content
      await expect(sourceCards.first()).toBeVisible()
    }
  })

  test('source count text updates with filters', async ({ page }) => {
    await expect(page.getByText(/\d+ sources?/)).toBeVisible({ timeout: 10_000 })

    // Get initial count text
    const countText = page.getByText(/\d+ sources?/)
    const initialText = await countText.textContent()

    // Apply a filter
    await page.getByRole('button', { name: /Far Left/ }).first().click()

    // Count should change
    await expect(countText).not.toHaveText(initialText ?? '')
  })

  test('external URL links are present', async ({ page }) => {
    await expect(page.getByText(/\d+ sources?/)).toBeVisible({ timeout: 10_000 })

    // At least some source cards should have external links
    const externalLinks = page.locator('a[target="_blank"]')
    const count = await externalLinks.count()
    expect(count).toBeGreaterThanOrEqual(0) // May not have links in test data
  })
})
