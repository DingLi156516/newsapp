import { test, expect } from '@playwright/test'

test.describe('Reading History', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/history')
  })

  test('page loads with Reading History heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Reading History' })).toBeVisible()
  })

  test('shows description text', async ({ page }) => {
    await expect(page.getByText(/previously read/)).toBeVisible()
  })

  test('shows story count', async ({ page }) => {
    await expect(page.getByText(/\d+ stor(y|ies) read/)).toBeVisible({ timeout: 10_000 })
  })

  test('back button navigates to feed', async ({ page }) => {
    await page.getByRole('button', { name: 'Feed' }).click()
    await expect(page).toHaveURL('/')
  })

  test('shows empty state or read stories', async ({ page }) => {
    const emptyState = page.getByText('No stories read yet')
    const storyCards = page.getByTestId('nexus-card')

    await expect(emptyState.or(storyCards.first())).toBeVisible({ timeout: 10_000 })
  })
})
