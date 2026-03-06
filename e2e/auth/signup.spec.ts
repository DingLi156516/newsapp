import { test, expect } from '@playwright/test'

test.describe('Signup Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup')
  })

  test('form renders with email, password, and confirm password', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible()
    await expect(page.getByPlaceholder('Email address')).toBeVisible()
    await expect(page.getByPlaceholder('Password', { exact: true })).toBeVisible()
    await expect(page.getByPlaceholder('Confirm password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible()
  })

  test('link to login page', async ({ page }) => {
    const loginLink = page.getByRole('link', { name: 'Sign in' })
    await expect(loginLink).toBeVisible()
    await loginLink.click()
    await expect(page).toHaveURL('/login')
  })

  test('validation shows error when passwords do not match', async ({ page }) => {
    await page.getByPlaceholder('Email address').fill('test@example.com')
    await page.getByPlaceholder('Password', { exact: true }).fill('ValidPassword123!')
    await page.getByPlaceholder('Confirm password').fill('DifferentPassword456!')
    await page.getByRole('button', { name: 'Create Account' }).click()

    await expect(page.getByText(/match/i)).toBeVisible()
  })

  test('validation shows error when email is missing', async ({ page }) => {
    await page.getByPlaceholder('Password', { exact: true }).fill('ValidPassword123!')
    await page.getByPlaceholder('Confirm password').fill('ValidPassword123!')
    await page.getByRole('button', { name: 'Create Account' }).click()

    await expect(page.getByText(/email/i).first()).toBeVisible()
  })

  test('validation shows error for short password', async ({ page }) => {
    await page.getByPlaceholder('Email address').fill('test@example.com')
    await page.getByPlaceholder('Password', { exact: true }).fill('ab')
    await page.getByPlaceholder('Confirm password').fill('ab')
    await page.getByRole('button', { name: 'Create Account' }).click()

    await expect(page.locator('text=/password|character/i').first()).toBeVisible()
  })

  test('Google OAuth button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Google/i })).toBeVisible()
  })
})
