import { test, expect } from '@playwright/test'

test.describe('Story Detail', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home and click first story
    await page.goto('/')
    const heroCard = page.getByTestId('hero-card')
    await expect(heroCard).toBeVisible({ timeout: 10_000 })
    await heroCard.click()
    await expect(page).toHaveURL(/\/story\//)
  })

  test('page loads with headline', async ({ page }) => {
    const headline = page.getByRole('heading', { level: 1 })
    await expect(headline).toBeVisible()
    await expect(headline).not.toBeEmpty()
  })

  test('back button navigates back', async ({ page }) => {
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page).toHaveURL('/')
  })

  test('spectrum bar renders with axis labels', async ({ page }) => {
    await expect(page.getByText('Coverage Spectrum', { exact: true })).toBeVisible()
    await expect(page.getByText('Far Left')).toBeVisible()
    await expect(page.getByText('Center')).toBeVisible()
    await expect(page.getByText('Far Right')).toBeVisible()
  })

  test('AI summary tabs switch content', async ({ page }) => {
    await expect(page.getByText('AI Perspectives')).toBeVisible()

    // Common Ground tab should be active by default
    const commonTab = page.getByTestId('ai-tab-common')
    await expect(commonTab).toHaveAttribute('aria-selected', 'true')

    // Switch to Left tab
    const leftTab = page.getByTestId('ai-tab-left')
    await leftTab.click()
    await expect(leftTab).toHaveAttribute('aria-selected', 'true')
    await expect(commonTab).toHaveAttribute('aria-selected', 'false')

    // Switch to Right tab
    const rightTab = page.getByTestId('ai-tab-right')
    await rightTab.click()
    await expect(rightTab).toHaveAttribute('aria-selected', 'true')
  })

  test('source list renders', async ({ page }) => {
    await expect(page.getByText('Sources', { exact: true })).toBeVisible()
  })

  test('bookmark button is visible', async ({ page }) => {
    const bookmarkBtn = page.getByTestId('bookmark-button').first()
    await expect(bookmarkBtn).toBeVisible()
  })

  test('metadata badges are visible', async ({ page }) => {
    // At least one of these should be visible on any story
    const badges = page.locator('.glass-pill')
    await expect(badges.first()).toBeVisible()
  })

  test('404-like state for nonexistent story', async ({ page }) => {
    await page.goto('/story/nonexistent-story-id-12345')
    await expect(page.getByText('Story not found')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Back to feed')).toBeVisible()
  })
})
