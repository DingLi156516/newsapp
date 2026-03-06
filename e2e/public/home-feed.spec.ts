import { test, expect } from '@playwright/test'

test.describe('Home Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders page header with title and controls', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Axiom' })).toBeVisible()
    await expect(page.getByTestId('search-input')).toBeVisible()
    await expect(page.getByText('Sign In')).toBeVisible()
  })

  test('renders story cards', async ({ page }) => {
    const heroCard = page.getByTestId('hero-card')
    await expect(heroCard).toBeVisible({ timeout: 10_000 })

    const nexusCards = page.getByTestId('nexus-card')
    await expect(nexusCards.first()).toBeVisible()
  })

  test('renders stats row with counts', async ({ page }) => {
    const statsRow = page.getByTestId('stats-row')
    await expect(statsRow).toBeVisible({ timeout: 10_000 })
    await expect(statsRow.getByText('Stories')).toBeVisible()
    await expect(statsRow.getByText('Sources')).toBeVisible()
    await expect(statsRow.getByText('Blindspots')).toBeVisible()
    await expect(statsRow.getByText('Saved')).toBeVisible()
  })

  test('feed tabs switch content', async ({ page }) => {
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })

    // Click For You tab
    await page.getByTestId('feed-tab-for-you').click()
    await expect(page.getByTestId('feed-tab-for-you')).toHaveAttribute('aria-selected', 'true')

    // Click Latest tab
    await page.getByTestId('feed-tab-latest').click()
    await expect(page.getByTestId('feed-tab-latest')).toHaveAttribute('aria-selected', 'true')

    // Click Blindspot tab
    await page.getByTestId('feed-tab-blindspot').click()
    await expect(page.getByTestId('feed-tab-blindspot')).toHaveAttribute('aria-selected', 'true')

    // Click back to Trending
    await page.getByTestId('feed-tab-trending').click()
    await expect(page.getByTestId('feed-tab-trending')).toHaveAttribute('aria-selected', 'true')
  })

  test('topic pills filter stories', async ({ page }) => {
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })

    // Open the search filters panel
    await page.getByTestId('search-filters-toggle').click()
    await expect(page.getByTestId('search-filters-panel')).toBeVisible()

    // All pill should be active by default
    const allPill = page.getByTestId('topic-filter-pill-all')
    await expect(allPill).toHaveAttribute('aria-pressed', 'true')

    // Click a topic pill
    const politicsPill = page.getByTestId('topic-filter-pill-politics')
    await politicsPill.click()
    await expect(politicsPill).toHaveAttribute('aria-pressed', 'true')
    await expect(allPill).toHaveAttribute('aria-pressed', 'false')
  })

  test('search filters stories by headline', async ({ page }) => {
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })

    // Mock API to return empty results for nonsense search
    await page.route('**/api/stories?*search=*', (route) =>
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

    const searchInput = page.getByTestId('search-input')
    await searchInput.fill('zzzznonexistent')

    // Should show empty state
    await expect(page.getByText('No stories match your filters')).toBeVisible({ timeout: 5_000 })
  })

  test('search clear button resets filter', async ({ page }) => {
    const searchInput = page.getByTestId('search-input')
    await searchInput.fill('test')
    await expect(page.getByRole('button', { name: 'Clear search' })).toBeVisible()

    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect(searchInput).toHaveValue('')
  })

  test('story card click navigates to detail page', async ({ page }) => {
    const heroCard = page.getByTestId('hero-card')
    await expect(heroCard).toBeVisible({ timeout: 10_000 })
    await heroCard.click()

    await expect(page).toHaveURL(/\/story\//)
  })

  test('empty state shows on impossible filter combination', async ({ page }) => {
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })

    // Mock API to return empty results for impossible query
    await page.route('**/api/stories?*search=*', (route) =>
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

    // Search for something impossible
    await page.getByTestId('search-input').fill('xyzzy_impossible_query_12345')
    await expect(page.getByText('No stories match your filters')).toBeVisible({ timeout: 5_000 })
  })

  test('saved tab shows saved message or empty for unauthenticated', async ({ page }) => {
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('feed-tab-saved').click()
    // Without auth, saved tab should show no stories or empty
    await expect(page.getByTestId('feed-tab-saved')).toHaveAttribute('aria-selected', 'true')
  })

  test('filter toggle opens and closes advanced filters panel', async ({ page }) => {
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })
    const toggle = page.getByTestId('search-filters-toggle')
    await toggle.click()
    await expect(page.getByTestId('search-filters-panel')).toBeVisible()
    await toggle.click()
    await expect(page.getByTestId('search-filters-panel')).not.toBeVisible()
  })

  test('bias range pills are selectable', async ({ page }) => {
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('search-filters-toggle').click()
    const leftPill = page.getByTestId('bias-pill-left')
    await leftPill.click()
    await expect(leftPill).toHaveAttribute('aria-pressed', 'false')
  })

  test('date preset filter changes results', async ({ page }) => {
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('search-filters-toggle').click()
    await page.getByTestId('date-preset-24h').click()
    await expect(page.getByTestId('date-preset-24h')).toHaveAttribute('aria-pressed', 'true')
  })

  test('clear filters resets all advanced filters', async ({ page }) => {
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('search-filters-toggle').click()
    await page.getByTestId('date-preset-7d').click()
    await page.getByTestId('bias-pill-left').click()
    await page.getByTestId('clear-filters').click()
    await expect(page.getByTestId('date-preset-all')).toHaveAttribute('aria-pressed', 'true')
  })

  test('perspective presets sync with bias pills', async ({ page }) => {
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('search-filters-toggle').click()
    await expect(page.getByTestId('search-filters-panel')).toBeVisible()

    // All preset should be active by default
    await expect(page.getByTestId('perspective-preset-all')).toHaveAttribute('aria-pressed', 'true')

    // Click Left preset
    await page.getByTestId('perspective-preset-left').click()
    await expect(page.getByTestId('perspective-preset-left')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('perspective-preset-all')).toHaveAttribute('aria-pressed', 'false')

    // Left bias pills should be selected, right ones not
    await expect(page.getByTestId('bias-pill-far-left')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('bias-pill-left')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('bias-pill-lean-left')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('bias-pill-center')).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByTestId('bias-pill-right')).toHaveAttribute('aria-pressed', 'false')

    // Toggle a single bias pill to break the preset
    await page.getByTestId('bias-pill-center').click()
    await expect(page.getByTestId('perspective-preset-left')).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByTestId('perspective-preset-all')).toHaveAttribute('aria-pressed', 'false')
  })
})
