import { test, expect } from '@playwright/test'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
  })

  test('page loads with Settings heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.getByText(/saved automatically/)).toBeVisible()
  })

  test('followed topics section renders with 9 topic pills', async ({ page }) => {
    await expect(page.getByText('Followed Topics')).toBeVisible({ timeout: 10_000 })

    const topicSection = page.locator('section').filter({ hasText: 'Followed Topics' })
    const topicButtons = topicSection.getByRole('button')
    await expect(topicButtons).toHaveCount(9)
  })

  test('topic toggle changes styling', async ({ page }) => {
    await expect(page.getByText('Followed Topics')).toBeVisible({ timeout: 10_000 })

    const topicSection = page.locator('section').filter({ hasText: 'Followed Topics' })
    const firstTopic = topicSection.getByRole('button').first()

    // Click to toggle
    await firstTopic.click()

    // Should show save indicator
    await expect(page.getByText('Preferences saved')).toBeVisible({ timeout: 5_000 })
  })

  test('perspective selector renders with 4 options', async ({ page }) => {
    await expect(page.getByText('Default Perspective')).toBeVisible({ timeout: 10_000 })

    const perspSection = page.locator('section').filter({ hasText: 'Default Perspective' })
    const perspButtons = perspSection.getByRole('button')
    await expect(perspButtons).toHaveCount(4)
  })

  test('factuality minimum selector renders with 5 options', async ({ page }) => {
    await expect(page.getByText('Minimum Factuality')).toBeVisible({ timeout: 10_000 })

    const factSection = page.locator('section').filter({ hasText: 'Minimum Factuality' })
    const factButtons = factSection.getByRole('button')
    await expect(factButtons).toHaveCount(5)
  })

  test('preferences saved indicator appears after change', async ({ page }) => {
    await expect(page.getByText('Minimum Factuality')).toBeVisible({ timeout: 10_000 })

    const factSection = page.locator('section').filter({ hasText: 'Minimum Factuality' })
    await factSection.getByRole('button').first().click()

    await expect(page.getByText('Preferences saved')).toBeVisible({ timeout: 5_000 })
  })
})
