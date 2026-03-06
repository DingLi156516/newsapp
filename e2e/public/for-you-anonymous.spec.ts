import { test, expect } from '@playwright/test'

test.describe('For You — Anonymous', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('hero-card')).toBeVisible({ timeout: 10_000 })
  })

  test('"For You" tab is visible and is the first tab', async ({ page }) => {
    const tablist = page.getByRole('tablist', { name: 'Feed tabs' })
    await expect(tablist).toBeVisible()

    const forYouTab = page.getByTestId('feed-tab-for-you')
    await expect(forYouTab).toBeVisible()

    // Verify it's the first tab in the tablist
    const firstTab = tablist.getByRole('tab').first()
    await expect(firstTab).toHaveText('For You')
  })

  test('clicking "For You" shows CTA overlay', async ({ page }) => {
    await page.getByTestId('feed-tab-for-you').click()
    await expect(page.getByTestId('feed-tab-for-you')).toHaveAttribute('aria-selected', 'true')

    const cta = page.getByTestId('for-you-cta')
    await expect(cta).toBeVisible()
    await expect(cta.getByText('Personalize Your Feed')).toBeVisible()
  })

  test('"Sign In" link in CTA navigates to /login', async ({ page }) => {
    await page.getByTestId('feed-tab-for-you').click()

    const cta = page.getByTestId('for-you-cta')
    await expect(cta).toBeVisible()

    await cta.getByRole('link', { name: 'Sign In' }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('"Maybe Later" switches to Trending tab', async ({ page }) => {
    await page.getByTestId('feed-tab-for-you').click()

    const cta = page.getByTestId('for-you-cta')
    await expect(cta).toBeVisible()

    await cta.getByRole('button', { name: 'Maybe Later' }).click()

    // CTA should disappear and Trending tab should be active
    await expect(cta).not.toBeVisible()
    await expect(page.getByTestId('feed-tab-trending')).toHaveAttribute('aria-selected', 'true')
  })
})
