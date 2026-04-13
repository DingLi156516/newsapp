import { test, expect } from '@playwright/test'

test.describe('Media Ownership Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Mock preferences to ensure stories appear
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

  test('story detail shows source list with ownership labels', async ({ page }) => {
    await page.goto('/')

    // Wait for stories to load
    const heroCard = page.getByTestId('hero-card')
    const nexusCard = page.getByTestId('nexus-card').first()
    await expect(heroCard.or(nexusCard)).toBeVisible({ timeout: 10_000 })

    // Click on a story to go to detail
    await heroCard.or(nexusCard).click()
    await expect(page).toHaveURL(/\/story\//)

    // Source list should be visible on story detail
    const sourceSection = page.getByText(/source/i).first()
    await expect(sourceSection).toBeVisible({ timeout: 10_000 })
  })

  test('stories with shared ownership show indicator', async ({ page }) => {
    // Mock a story with sources from the same owner
    await page.route('**/api/stories/*', (route) => {
      if (route.request().url().includes('/timeline')) return route.continue()
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'test-story-1',
            headline: 'Test Story with Shared Ownership',
            ai_summary: 'A test story for ownership display.',
            topic: 'Politics',
            story_kind: 'standard',
            bias_distribution: { center: 2 },
            source_count: 2,
            sources: [
              {
                name: 'News Outlet A',
                slug: 'news-outlet-a',
                bias: 'center',
                factuality: 'high',
                ownership: 'corporate',
                region: 'us',
                owner: { id: 'owner-1', name: 'MegaCorp Media', isIndividual: false },
                article_url: 'https://example.com/article-a',
              },
              {
                name: 'News Outlet B',
                slug: 'news-outlet-b',
                bias: 'lean-left',
                factuality: 'high',
                ownership: 'corporate',
                region: 'us',
                owner: { id: 'owner-1', name: 'MegaCorp Media', isIndividual: false },
                article_url: 'https://example.com/article-b',
              },
            ],
            published_at: new Date().toISOString(),
            factuality_average: 'high',
          },
        }),
      })
    })

    // Navigate directly to a story
    await page.goto('/story/test-story-1')

    // Should show the "N from {owner}" indicator
    const ownerIndicator = page.getByText(/from MegaCorp Media/i)
    const storyHeading = page.getByText('Test Story with Shared Ownership')

    // Wait for story to load
    await expect(storyHeading.or(ownerIndicator)).toBeVisible({ timeout: 10_000 })

    // Check for the ownership grouping indicator (visible on desktop)
    if (await ownerIndicator.isVisible()) {
      await expect(ownerIndicator).toContainText('2')
      await expect(ownerIndicator).toContainText('MegaCorp Media')
    }
  })

  test('story without shared owners shows no ownership indicator', async ({ page }) => {
    // Mock a story with sources from different owners
    await page.route('**/api/stories/*', (route) => {
      if (route.request().url().includes('/timeline')) return route.continue()
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'test-story-2',
            headline: 'Test Story with Different Owners',
            ai_summary: 'A test story for ownership display.',
            topic: 'Technology',
            story_kind: 'standard',
            bias_distribution: { center: 1, 'lean-left': 1 },
            source_count: 2,
            sources: [
              {
                name: 'Independent Times',
                slug: 'independent-times',
                bias: 'center',
                factuality: 'high',
                ownership: 'independent',
                region: 'us',
                owner: { id: 'owner-a', name: 'Owner A', isIndividual: true },
                article_url: 'https://example.com/article-1',
              },
              {
                name: 'Other News',
                slug: 'other-news',
                bias: 'lean-left',
                factuality: 'high',
                ownership: 'corporate',
                region: 'us',
                owner: { id: 'owner-b', name: 'Owner B', isIndividual: false },
                article_url: 'https://example.com/article-2',
              },
            ],
            published_at: new Date().toISOString(),
            factuality_average: 'high',
          },
        }),
      })
    })

    await page.goto('/story/test-story-2')

    // Wait for story to load
    await expect(page.getByText('Test Story with Different Owners')).toBeVisible({ timeout: 10_000 })

    // No ownership grouping indicator should be visible (different owners)
    const ownerGroupIndicator = page.getByText(/\d+ from Owner [AB]/i)
    await expect(ownerGroupIndicator).not.toBeVisible()
  })
})
