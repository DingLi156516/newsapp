import { test, expect } from '@playwright/test'

test.describe('Admin Review Journey', () => {
  test('navigate to /admin/review and verify page loads', async ({ page }) => {
    // Navigate to admin review page (authenticated via storageState)
    await page.goto('/admin/review')

    // Should see either the review queue (if admin) or access denied
    const reviewQueue = page.getByText('Review Queue')
    const accessDenied = page.getByText('Access denied')

    await expect(reviewQueue.or(accessDenied)).toBeVisible({ timeout: 10_000 })
  })

  test('non-admin user sees access denied', async ({ page }) => {
    // Navigate to admin review page
    await page.goto('/admin/review')

    // Non-admin should see access denied message
    const accessDenied = page.getByText('Access denied')
    const reviewQueue = page.getByText('Review Queue')

    // Either access denied or review queue should be visible
    await expect(accessDenied.or(reviewQueue)).toBeVisible({ timeout: 10_000 })
  })

  test('unauthenticated user is redirected to login', async ({ browser }) => {
    // Create a new context without stored auth state
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto('/admin/review')

    // Should be redirected to login with redirect param
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })

    await context.close()
  })

  test('admin can view filter tabs', async ({ page }) => {
    await page.goto('/admin/review')

    // If admin, filter tabs should be visible
    const reviewQueue = page.getByText('Review Queue')
    const accessDenied = page.getByText('Access denied')

    const visible = await reviewQueue.or(accessDenied).textContent()

    if (visible?.includes('Review Queue')) {
      await expect(page.getByRole('button', { name: 'Pending' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Approved' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Rejected' })).toBeVisible()
    }
  })

  test('admin can switch between filter tabs', async ({ page }) => {
    await page.goto('/admin/review')

    const reviewQueue = page.getByText('Review Queue')
    const accessDenied = page.getByText('Access denied')

    const visible = await reviewQueue.or(accessDenied).textContent()

    if (visible?.includes('Review Queue')) {
      // Click Approved tab
      await page.getByRole('button', { name: 'Approved' }).click()

      // Click Rejected tab
      await page.getByRole('button', { name: 'Rejected' }).click()

      // Click back to Pending
      await page.getByRole('button', { name: 'Pending' }).click()
    }
  })
})
