import { test, expect } from '@playwright/test'

test.describe('Blindspot Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blindspot')
  })

  test('renders banner with explanatory text', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Blindspot Feed' })).toBeVisible()
    await expect(page.getByText(/coverage skew greater than 80%/)).toBeVisible()
  })

  test('displays blindspot count', async ({ page }) => {
    await expect(page.getByText(/blindspot stor/)).toBeVisible({ timeout: 10_000 })
  })

  test('renders story cards', async ({ page }) => {
    // Wait for loading to finish - either cards or empty state
    const cards = page.getByTestId('nexus-card')
    const emptyState = page.getByText('No blindspot stories detected')

    await expect(cards.first().or(emptyState)).toBeVisible({ timeout: 10_000 })
  })

  test('back button navigates to home', async ({ page }) => {
    await page.getByRole('button', { name: 'Feed' }).click()
    await expect(page).toHaveURL('/')
  })

  test('card click navigates to story detail', async ({ page }) => {
    const firstCard = page.getByTestId('nexus-card').first()
    // Only test if there are blindspot stories
    const count = await firstCard.count()
    if (count > 0) {
      await firstCard.click()
      await expect(page).toHaveURL(/\/story\//)
    }
  })
})
