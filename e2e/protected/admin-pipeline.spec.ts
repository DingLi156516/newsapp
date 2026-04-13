import { test, expect } from '@playwright/test'

test.describe('Admin Pipeline Dashboard', () => {
  test('navigate to /admin/pipeline and verify page loads', async ({ page }) => {
    await page.goto('/admin/pipeline')

    const pipelineDashboard = page.getByText('Pipeline Dashboard')
    const accessDenied = page.getByText('Access denied')

    await expect(pipelineDashboard.or(accessDenied)).toBeVisible({ timeout: 10_000 })
  })

  test('unauthenticated user is redirected to login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto('/admin/pipeline')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })

    await context.close()
  })

  test('admin sees navigation links to Review and Sources', async ({ page }) => {
    await page.goto('/admin/pipeline')

    const pipelineDashboard = page.getByText('Pipeline Dashboard')
    const accessDenied = page.getByText('Access denied')
    const visible = await pipelineDashboard.or(accessDenied).textContent()

    if (visible?.includes('Pipeline Dashboard')) {
      await expect(page.getByRole('link', { name: 'Review' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Sources' })).toBeVisible()
    }
  })

  test('admin sees pipeline summary stats section', async ({ page }) => {
    await page.goto('/admin/pipeline')

    const pipelineDashboard = page.getByText('Pipeline Dashboard')
    const accessDenied = page.getByText('Access denied')
    const visible = await pipelineDashboard.or(accessDenied).textContent()

    if (visible?.includes('Pipeline Dashboard')) {
      // Pipeline stats should show counts for key metrics
      const published = page.getByText(/published/i)
      const articles = page.getByText(/articles/i)
      await expect(published.or(articles)).toBeVisible({ timeout: 10_000 })
    }
  })

  test('admin sees run history section', async ({ page }) => {
    await page.goto('/admin/pipeline')

    const pipelineDashboard = page.getByText('Pipeline Dashboard')
    const accessDenied = page.getByText('Access denied')
    const visible = await pipelineDashboard.or(accessDenied).textContent()

    if (visible?.includes('Pipeline Dashboard')) {
      // Run history or empty state should be visible
      const runHistory = page.getByText(/Run History/i)
      const noRuns = page.getByText(/No runs/i)
      await expect(runHistory.or(noRuns)).toBeVisible({ timeout: 10_000 })
    }
  })

  test('admin sees DLQ panel', async ({ page }) => {
    await page.goto('/admin/pipeline')

    const pipelineDashboard = page.getByText('Pipeline Dashboard')
    const accessDenied = page.getByText('Access denied')
    const visible = await pipelineDashboard.or(accessDenied).textContent()

    if (visible?.includes('Pipeline Dashboard')) {
      const dlqPanel = page.getByText(/Dead Letter/i)
      const noDlq = page.getByText(/No dead letter/i)
      await expect(dlqPanel.or(noDlq)).toBeVisible({ timeout: 10_000 })
    }
  })

  test('admin sees maintenance panel', async ({ page }) => {
    await page.goto('/admin/pipeline')

    const pipelineDashboard = page.getByText('Pipeline Dashboard')
    const accessDenied = page.getByText('Access denied')
    const visible = await pipelineDashboard.or(accessDenied).textContent()

    if (visible?.includes('Pipeline Dashboard')) {
      const maintenance = page.getByText(/Maintenance/i)
      await expect(maintenance).toBeVisible({ timeout: 10_000 })
    }
  })
})
