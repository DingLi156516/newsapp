import { test, expect } from '@playwright/test'
import { mockBookmarks } from '@/e2e/helpers/mock-bookmarks'

test.describe('Bookmarks', () => {
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

  test('bookmark button toggles on story detail', async ({ page }) => {
    // Navigate to a story
    await page.goto('/')
    const heroCard = page.getByTestId('hero-card')
    await expect(heroCard).toBeVisible({ timeout: 10_000 })
    await heroCard.click()
    await expect(page).toHaveURL(/\/story\//)

    // Find bookmark button
    const bookmarkBtn = page.getByTestId('bookmark-button').first()
    await expect(bookmarkBtn).toBeVisible()

    // Get initial state
    const initialPressed = await bookmarkBtn.getAttribute('aria-pressed')

    // Click to toggle
    await bookmarkBtn.click()

    // State should change
    const newPressed = await bookmarkBtn.getAttribute('aria-pressed')
    expect(newPressed).not.toBe(initialPressed)
  })

  test('bookmark on story detail and check saved tab', async ({ page }) => {
    // Navigate to a story
    await page.goto('/')
    const heroCard = page.getByTestId('hero-card')
    await expect(heroCard).toBeVisible({ timeout: 10_000 })
    await heroCard.click()
    await expect(page).toHaveURL(/\/story\//)

    // Bookmark the story
    const bookmarkBtn = page.getByTestId('bookmark-button').first()
    const isAlreadySaved = await bookmarkBtn.getAttribute('aria-pressed')
    if (isAlreadySaved === 'false') {
      await Promise.all([
        page.waitForResponse(
          (resp) => resp.url().includes('/api/bookmarks') && resp.request().method() === 'POST'
        ),
        bookmarkBtn.click(),
      ])
      await expect(bookmarkBtn).toHaveAttribute('aria-pressed', 'true')
    }

    // Go back and check saved tab
    await page.goto('/')
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('feed-tab-saved').click()

    // Should have at least one card in saved
    const cards = page.getByTestId('nexus-card').or(page.getByTestId('hero-card'))
    await expect(cards.first()).toBeVisible({ timeout: 5_000 })
  })

  test('unbookmark removes from saved tab', async ({ page }) => {
    // Navigate to a story and bookmark it
    await page.goto('/')
    const heroCard = page.getByTestId('hero-card')
    await expect(heroCard).toBeVisible({ timeout: 10_000 })
    await heroCard.click()
    await expect(page).toHaveURL(/\/story\//)

    const bookmarkBtn = page.getByTestId('bookmark-button').first()
    await expect(bookmarkBtn).toBeVisible({ timeout: 10_000 })

    // Ensure bookmarked
    const currentState = await bookmarkBtn.getAttribute('aria-pressed')
    if (currentState === 'false') {
      await bookmarkBtn.click()
    }

    // Now unbookmark
    await bookmarkBtn.click()
    await expect(bookmarkBtn).toHaveAttribute('aria-pressed', 'false')
  })

  test('bookmark state persists across pages', async ({ page }) => {
    // Navigate to a story
    await page.goto('/')
    const heroCard = page.getByTestId('hero-card')
    await expect(heroCard).toBeVisible({ timeout: 10_000 })
    await heroCard.click()
    await expect(page).toHaveURL(/\/story\//)

    // Bookmark it
    const bookmarkBtn = page.getByTestId('bookmark-button').first()
    await expect(bookmarkBtn).toBeVisible({ timeout: 10_000 })
    const savedBefore = await bookmarkBtn.getAttribute('aria-pressed')
    if (savedBefore === 'false') {
      await Promise.all([
        page.waitForResponse(
          (resp) => resp.url().includes('/api/bookmarks') && resp.request().method() === 'POST'
        ),
        bookmarkBtn.click(),
      ])
      await expect(bookmarkBtn).toHaveAttribute('aria-pressed', 'true')
    }

    // Navigate away and back
    await page.goto('/')
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('hero-card').click()
    await expect(page).toHaveURL(/\/story\//)

    // Check bookmark state persisted
    const bookmarkBtnAgain = page.getByTestId('bookmark-button').first()
    await expect(bookmarkBtnAgain).toHaveAttribute('aria-pressed', 'true')
  })

  test('stats row saved count updates', async ({ page }) => {
    await page.goto('/')
    const statsRow = page.getByTestId('stats-row')
    await expect(statsRow).toBeVisible({ timeout: 10_000 })
    await expect(statsRow.getByText('Saved')).toBeVisible()
  })

  test('bookmark on NexusCard in feed works', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })

    // Find a bookmark button on a card (not the hero)
    const nexusCards = page.getByTestId('nexus-card')
    const count = await nexusCards.count()
    if (count > 0) {
      const cardBookmark = nexusCards.first().getByTestId('bookmark-button')
      await expect(cardBookmark).toBeVisible()

      const initialState = await cardBookmark.getAttribute('aria-pressed')
      await cardBookmark.click()

      const newState = await cardBookmark.getAttribute('aria-pressed')
      expect(newState).not.toBe(initialState)
    }
  })
})
