/**
 * Shared data-testid constants for E2E selectors.
 * Use page.getByTestId(SELECTORS.xxx) for consistent element targeting.
 */
export const SELECTORS = {
  // Cards
  nexusCard: 'nexus-card',
  heroCard: 'hero-card',

  // Feed controls
  feedTab: (name: string) => `feed-tab-${name.toLowerCase()}`,
  topicPill: (name: string) => `topic-pill-${name.toLowerCase()}`,
  searchInput: 'search-input',

  // For You
  forYouCta: 'for-you-cta',

  // Story detail
  aiTab: (name: string) => `ai-tab-${name.toLowerCase()}`,
  bookmarkButton: 'bookmark-button',

  // User menu
  userMenuTrigger: 'user-menu-trigger',
  userMenuDropdown: 'user-menu-dropdown',

  // Stats
  statsRow: 'stats-row',
} as const
