import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { defineConfig, devices } from '@playwright/test'

// Load .env.local for test credentials (Playwright doesn't auto-load Next.js env files)
const envPath = resolve(__dirname, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const [, key, value] = match
      process.env[key.trim()] = value.trim()
    }
  }
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const webServerPort = new URL(baseURL).port || '3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 2,
  reporter: 'html',
  outputDir: 'e2e-results',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
    },
    {
      name: 'chromium-public',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /public\/.*\.spec\.ts|auth\/.*\.spec\.ts/,
    },
    {
      name: 'chromium-authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /protected\/.*\.spec\.ts/,
    },
    {
      name: 'chromium-journeys',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /journeys\/.*\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${webServerPort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
