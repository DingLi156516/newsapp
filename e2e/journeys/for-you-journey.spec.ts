import { test, expect } from '@playwright/test'

test.describe('For You Journey', () => {
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

  test('home → For You tab → see stories → click story → back → For You still works', async ({ page }) => {
    // Step 1: Go to home and wait for stories
    await page.goto('/')
    const heroCard = page.getByTestId('hero-card')
    await expect(heroCard).toBeVisible({ timeout: 10_000 })

    // Step 2: Click "For You" tab
    await page.getByTestId('feed-tab-for-you').click()
    await expect(page.getByTestId('feed-tab-for-you')).toHaveAttribute('aria-selected', 'true')

    // Step 3: CTA should NOT be visible (authenticated user)
    await expect(page.getByTestId('for-you-cta')).not.toBeVisible()

    // Step 4: Wait for personalized stories to load
    const stories = page.getByTestId('nexus-card').or(page.getByTestId('hero-card'))
    await expect(stories.first()).toBeVisible({ timeout: 10_000 })

    // Step 5: Click the first story
    await stories.first().click()
    await expect(page).toHaveURL(/\/story\//)

    // Step 6: Verify story detail loaded
    await expect(page.getByTestId('bookmark-button').first()).toBeVisible({ timeout: 10_000 })

    // Step 7: Navigate back to home
    await page.goto('/')
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })

    // Step 8: Click "For You" again — should still work
    await page.getByTestId('feed-tab-for-you').click()
    await expect(page.getByTestId('feed-tab-for-you')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('for-you-cta')).not.toBeVisible()

    // Stories should load again
    await expect(stories.first()).toBeVisible({ timeout: 10_000 })
  })
})
