import { test, expect } from '@playwright/test'

test.describe('For You — Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    // Mock preferences with defaults
    await page.route('**/api/preferences', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              followed_topics: ['politics', 'technology'],
              default_perspective: 'all',
              factuality_minimum: 'mixed',
            },
          }),
        })
      }
      return route.continue()
    })
  })

  test('"For You" tab is first and clickable', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })

    const forYouTab = page.getByTestId('feed-tab-for-you')
    await expect(forYouTab).toBeVisible()
    await forYouTab.click()
    await expect(forYouTab).toHaveAttribute('aria-selected', 'true')
  })

  test('"For You" feed loads stories without CTA', async ({ page }) => {
    // Mock the for-you API to return predictable data
    await page.route('**/api/stories/for-you*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          meta: { total: 0, page: 1, limit: 20 },
        }),
      })
    )

    await page.goto('/')
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })

    await page.getByTestId('feed-tab-for-you').click()
    await expect(page.getByTestId('feed-tab-for-you')).toHaveAttribute('aria-selected', 'true')

    // CTA should NOT be visible for authenticated users
    await expect(page.getByTestId('for-you-cta')).not.toBeVisible()
    await expect
      .poll(async () => {
        const hasEmpty = await page.getByText('No stories match your filters.').isVisible().catch(() => false)
        const hasHero = await page.getByTestId('hero-card').isVisible().catch(() => false)
        const hasGrid = await page.getByTestId('nexus-card').first().isVisible().catch(() => false)
        return hasEmpty || hasHero || hasGrid
      })
      .toBe(true)
  })

  test('switching tabs preserves for-you state', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })

    // Click For You
    await page.getByTestId('feed-tab-for-you').click()
    await expect(page.getByTestId('feed-tab-for-you')).toHaveAttribute('aria-selected', 'true')

    // Switch to Trending
    await page.getByTestId('feed-tab-trending').click()
    await expect(page.getByTestId('feed-tab-trending')).toHaveAttribute('aria-selected', 'true')

    // Switch back to For You — should still work
    await page.getByTestId('feed-tab-for-you').click()
    await expect(page.getByTestId('feed-tab-for-you')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('for-you-cta')).not.toBeVisible()
  })
})
