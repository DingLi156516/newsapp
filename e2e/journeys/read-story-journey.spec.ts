import { test, expect } from '@playwright/test'

test.describe('Read Story Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Mock preferences with defaults so stories always appear
    await page.route('**/api/preferences', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              followed_topics: [],
              default_perspective: 'all',
              factuality_minimum: 'mixed',
            },
          }),
        })
      }
      return route.continue()
    })
  })

  test('home → click story → verify detail → back → check history', async ({ page }) => {
    // Step 1: Start at home
    await page.goto('/')
    const heroCard = page.getByTestId('hero-card')
    await expect(heroCard).toBeVisible({ timeout: 10_000 })

    // Remember the headline
    const headline = await heroCard.locator('h2').textContent()

    // Step 2: Click the story
    await heroCard.click()
    await expect(page).toHaveURL(/\/story\//)

    // Step 3: Verify detail page loads with the headline
    const detailHeadline = page.getByRole('heading', { level: 1 })
    await expect(detailHeadline).toBeVisible()
    expect(await detailHeadline.textContent()).toBe(headline)

    // Verify key sections
    await expect(page.getByText('Coverage Spectrum', { exact: true })).toBeVisible()
    await expect(page.getByText('AI Perspectives')).toBeVisible()

    // Step 4: Navigate back
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page).toHaveURL('/')

    // Step 5: Check reading history
    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'Reading History' })).toBeVisible()

    // The story we just read should appear (or count should be > 0)
    await expect(page.getByText(/\d+ stor(y|ies) read/)).toBeVisible({ timeout: 10_000 })
  })
})
