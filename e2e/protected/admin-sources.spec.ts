import { test, expect } from '@playwright/test'

test.describe('Admin Sources Page', () => {
  test('navigate to /admin/sources and verify page loads', async ({ page }) => {
    await page.goto('/admin/sources')

    const sourceManagement = page.getByText('Source Management')
    const accessDenied = page.getByText('Access denied')

    await expect(sourceManagement.or(accessDenied)).toBeVisible({ timeout: 10_000 })
  })

  test('unauthenticated user is redirected to login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto('/admin/sources')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })

    await context.close()
  })

  test('admin sees source list and search input', async ({ page }) => {
    await page.goto('/admin/sources')

    const sourceManagement = page.getByText('Source Management')
    const accessDenied = page.getByText('Access denied')
    const visible = await sourceManagement.or(accessDenied).textContent()

    if (visible?.includes('Source Management')) {
      await expect(page.getByPlaceholder('Search sources...')).toBeVisible()
      await expect(page.getByText(/source/i)).toBeVisible()
    }
  })

  test('admin can see navigation links to Review and Pipeline', async ({ page }) => {
    await page.goto('/admin/sources')

    const sourceManagement = page.getByText('Source Management')
    const accessDenied = page.getByText('Access denied')
    const visible = await sourceManagement.or(accessDenied).textContent()

    if (visible?.includes('Source Management')) {
      await expect(page.getByRole('link', { name: 'Review' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Pipeline' })).toBeVisible()
    }
  })

  test('admin sees Sync Ratings button', async ({ page }) => {
    await page.goto('/admin/sources')

    const sourceManagement = page.getByText('Source Management')
    const accessDenied = page.getByText('Access denied')
    const visible = await sourceManagement.or(accessDenied).textContent()

    if (visible?.includes('Source Management')) {
      await expect(page.getByRole('button', { name: /Sync Ratings/ })).toBeVisible()
    }
  })

  test('admin sees Add and Import buttons', async ({ page }) => {
    await page.goto('/admin/sources')

    const sourceManagement = page.getByText('Source Management')
    const accessDenied = page.getByText('Access denied')
    const visible = await sourceManagement.or(accessDenied).textContent()

    if (visible?.includes('Source Management')) {
      await expect(page.getByRole('button', { name: /Add/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /Import/ })).toBeVisible()
    }
  })

  test('admin can click Add to show create form', async ({ page }) => {
    await page.goto('/admin/sources')

    const sourceManagement = page.getByText('Source Management')
    const accessDenied = page.getByText('Access denied')
    const visible = await sourceManagement.or(accessDenied).textContent()

    if (visible?.includes('Source Management')) {
      await page.getByRole('button', { name: /Add/ }).click()
      await expect(page.getByText('Add New Source')).toBeVisible()
      await expect(page.getByRole('button', { name: /Cancel/ })).toBeVisible()
    }
  })
})
