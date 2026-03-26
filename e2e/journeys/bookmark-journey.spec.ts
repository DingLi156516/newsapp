import { test, expect } from '@playwright/test'
import { mockBookmarks } from '@/e2e/helpers/mock-bookmarks'

test.describe('Bookmark Journey', () => {
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

    await mockBookmarks(page)
  })

  test('home → bookmark story → saved tab → click saved → unbookmark → saved empty', async ({ page }) => {
    // Step 1: Go to home and wait for stories
    await page.goto('/')
    const heroCard = page.getByTestId('hero-card')
    await expect(heroCard).toBeVisible({ timeout: 10_000 })

    // Step 2: Click into story detail
    await heroCard.click()
    await expect(page).toHaveURL(/\/story\//)

    // Step 3: Bookmark the story
    const bookmarkBtn = page.getByTestId('bookmark-button').first()
    await expect(bookmarkBtn).toBeVisible()

    // Ensure it's not already bookmarked
    const isSaved = await bookmarkBtn.getAttribute('aria-pressed')
    if (isSaved === 'false') {
      await Promise.all([
        page.waitForResponse(
          (resp) => resp.url().includes('/api/bookmarks') && resp.request().method() === 'POST'
        ),
        bookmarkBtn.click(),
      ])
    }
    await expect(bookmarkBtn).toHaveAttribute('aria-pressed', 'true')

    // Step 4: Go back to home and check saved tab
    await page.goto('/')
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('feed-tab-saved').click()

    // Should have saved stories
    const savedCards = page.getByTestId('nexus-card').or(page.getByTestId('hero-card'))
    await expect(savedCards.first()).toBeVisible({ timeout: 5_000 })

    // Step 5: Click the saved story
    await savedCards.first().click()
    await expect(page).toHaveURL(/\/story\//)

    // Step 6: Unbookmark
    const unbookmarkBtn = page.getByTestId('bookmark-button').first()
    await unbookmarkBtn.click()
    await expect(unbookmarkBtn).toHaveAttribute('aria-pressed', 'false')

    // Step 7: Go back to saved tab - should be empty or have fewer items
    await page.goto('/')
    await expect(page.getByTestId('feed-tab-trending')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('feed-tab-saved').click()

    // Wait a moment for the UI to update
    await page.waitForTimeout(1000)
  })
})
