import { test, expect } from '@playwright/test'

test.describe('For You Journey', () => {
  test.beforeEach(async ({ page }) => {
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

  test('home → story detail → back home → For You still settles correctly', async ({ page }) => {
    await page.goto('/')

    const heroCard = page.getByTestId('hero-card')
    await expect(heroCard).toBeVisible({ timeout: 10_000 })

    await heroCard.getByRole('link', { name: /Open story:/ }).click()
    await expect(page).toHaveURL(/\/story\//)
    await expect(page.getByTestId('bookmark-button').first()).toBeVisible({ timeout: 10_000 })

    await page.goto('/')
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })

    await page.getByTestId('feed-tab-for-you').click()
    await expect(page.getByTestId('feed-tab-for-you')).toHaveAttribute('aria-selected', 'true')
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
})
