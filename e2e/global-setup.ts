import { test as setup, expect } from '@playwright/test'
import { TEST_USER } from './fixtures/test-data'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('Email address').fill(TEST_USER.email)
  await page.getByPlaceholder('Password').fill(TEST_USER.password)
  await page.getByRole('button', { name: 'Sign In' }).click()

  // Wait for redirect to home page after login
  await expect(page).toHaveURL('/', { timeout: 10_000 })

  // Save auth state
  await page.context().storageState({ path: 'e2e/.auth/user.json' })
})
