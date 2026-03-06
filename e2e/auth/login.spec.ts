import { test, expect } from '@playwright/test'

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('form renders with email, password, and submit button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
    await expect(page.getByPlaceholder('Email address')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  test('link to signup page', async ({ page }) => {
    const signupLink = page.getByRole('link', { name: 'Sign up' })
    await expect(signupLink).toBeVisible()
    await signupLink.click()
    await expect(page).toHaveURL('/signup')
  })

  test('validation shows error for empty fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign In' }).click()

    // Should show validation errors
    await expect(page.getByText(/email/i).first()).toBeVisible()
  })

  test('validation shows error for invalid email', async ({ page }) => {
    await page.getByPlaceholder('Email address').fill('notanemail')
    await page.getByPlaceholder('Password').fill('ValidPassword123!')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.getByText(/email/i).first()).toBeVisible()
  })

  test('validation shows error for short password', async ({ page }) => {
    await page.getByPlaceholder('Email address').fill('test@example.com')
    await page.getByPlaceholder('Password').fill('ab')
    await page.getByRole('button', { name: 'Sign In' }).click()

    // Password validation error
    await expect(page.locator('text=/password|character/i').first()).toBeVisible()
  })

  test('password show/hide toggle works', async ({ page }) => {
    const passwordInput = page.getByPlaceholder('Password')
    await expect(passwordInput).toHaveAttribute('type', 'password')

    // Click show password button
    await page.getByRole('button', { name: 'Show password' }).click()
    await expect(passwordInput).toHaveAttribute('type', 'text')

    // Click hide password button
    await page.getByRole('button', { name: 'Hide password' }).click()
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('Google OAuth button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Google/i })).toBeVisible()
  })

  test('error param displays authentication failed message', async ({ page }) => {
    await page.goto('/login?error=auth_callback_failed')
    await expect(page.getByText('Authentication failed')).toBeVisible()
  })
})
