/**
 * Test data constants for E2E tests.
 *
 * Test user credentials come from environment variables.
 * Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD in .env.local.
 */
export const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL ?? 'e2e-test@axiom.dev',
  password: process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!',
}

export const ROUTES = {
  home: '/',
  blindspot: '/blindspot',
  sources: '/sources',
  login: '/login',
  signup: '/signup',
  dashboard: '/dashboard',
  settings: '/settings',
  history: '/history',
} as const

export const FEED_TABS = ['For You', 'Trending', 'Latest', 'Blindspot', 'Saved'] as const

export const TOPIC_LABELS = [
  'All', 'Politics', 'World', 'Technology', 'Business',
  'Science', 'Health', 'Culture', 'Sports', 'Environment',
] as const

export const BIAS_LABELS = [
  'Far Left', 'Left', 'Lean Left', 'Center', 'Lean Right', 'Right', 'Far Right',
] as const

export const FACTUALITY_LABELS = [
  'Very High', 'High', 'Mixed', 'Low', 'Very Low',
] as const
