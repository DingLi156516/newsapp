import { test, expect } from '@playwright/test'

test.describe('Onboarding Journey', () => {
  test('login → user menu → settings → toggle topic → verify saved → back to feed', async ({ page }) => {
    // Step 1: Visit login page (already authenticated via storageState)
    // With storageState, middleware will redirect authenticated user to home
    await page.goto('/login')
    await expect(page).toHaveURL('/')

    // Step 2: Open User Menu
    await page.getByTestId('user-menu-trigger').click()
    await expect(page.getByTestId('user-menu-dropdown')).toBeVisible()

    // Step 3: Navigate to Settings
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page).toHaveURL('/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    // Step 4: Wait for form to load
    await expect(page.getByText('Followed Topics')).toBeVisible({ timeout: 10_000 })

    // Step 5: Toggle a topic
    const topicSection = page.locator('section').filter({ hasText: 'Followed Topics' })
    const firstTopic = topicSection.getByRole('button').first()
    await firstTopic.click()

    // Step 6: Verify save indicator appears
    await expect(page.getByText('Preferences saved')).toBeVisible({ timeout: 5_000 })

    // Step 7: Navigate back to feed
    await page.getByRole('button', { name: 'Feed' }).click()
    await expect(page).toHaveURL('/')

    // Step 10: Verify feed loads
    await expect(page.getByTestId('hero-card').or(page.getByText('No stories'))).toBeVisible({ timeout: 10_000 })
  })
})
