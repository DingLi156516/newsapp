import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
  useNetInfo: () => ({ isConnected: true, isInternetReachable: true }),
}))

jest.mock('@/lib/hooks/use-stories', () => {
  const mockStories = [
    { id: '1', title: 'Story One', headline: 'Story One', summary: 'Summary 1', bias: 'center', factuality: 'high', coverage_count: 3, sourceCount: 3, timestamp: '2026-03-27T00:00:00Z', sources: ['AP'], topic: 'politics', spectrumSegments: [{ bias: 'center', percentage: 100, sources: ['AP'] }] },
    { id: '2', title: 'Story Two', headline: 'Story Two', summary: 'Summary 2', bias: 'left', factuality: 'high', coverage_count: 5, sourceCount: 5, timestamp: '2026-03-26T00:00:00Z', sources: ['CNN'], topic: 'technology', spectrumSegments: [{ bias: 'left', percentage: 100, sources: ['CNN'] }] },
  ]
  const mockResult = { stories: mockStories, total: 2, isLoading: false, isError: false, mutate: jest.fn() }
  return { useStories: () => mockResult }
})

const mockForYouResult = { stories: [] as unknown[], total: 0, isLoading: false, isError: false, isAuthenticated: true, mutate: jest.fn() }
jest.mock('@/lib/hooks/use-for-you', () => ({
  useForYou: () => mockForYouResult,
}))

jest.mock('@/lib/hooks/use-bookmarks', () => ({
  useBookmarks: () => ({
    isBookmarked: () => false,
    toggle: jest.fn().mockResolvedValue('toggled'),
    count: 0,
    bookmarkedIds: [],
  }),
}))

jest.mock('@/lib/hooks/use-reading-history', () => ({
  useReadingHistory: () => ({
    isRead: () => false,
    markAsRead: jest.fn(),
    markAsUnread: jest.fn(),
    readCount: 0,
    readStoryIds: [],
  }),
}))

jest.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({
    showToast: jest.fn(),
    hideToast: jest.fn(),
    toast: null,
  }),
}))

jest.mock('@/lib/hooks/use-debounce', () => ({
  useDebounce: (value: string) => value,
}))

jest.mock('@/lib/hooks/use-preferences', () => ({
  usePreferences: () => ({
    preferences: {
      followed_topics: [],
      default_perspective: 'all',
      factuality_minimum: 'mixed',
      blindspot_digest_enabled: false,
    },
    updatePreferences: jest.fn(),
  }),
}))

jest.mock('@/lib/hooks/use-feed-config', () => ({
  useFeedConfig: () => ({
    visibleFeeds: ['for-you', 'trending', 'latest', 'blindspot', 'politics', 'technology'],
    feedSort: 'most-covered',
    isLoaded: true,
    updateConfig: jest.fn(),
  }),
}))

jest.mock('lucide-react-native', () => {
  const RN = require('react-native')
  const R = require('react')
  return new Proxy({}, {
    get: (_target: unknown, prop: string) =>
      (props: Record<string, unknown>) => R.createElement(RN.View, { testID: `icon-${prop}`, ...props }),
  })
})

import HomeFeedScreen from '@/app/(tabs)/index'

describe('HomeFeedScreen', () => {
  it('renders the Axiom header', () => {
    render(<HomeFeedScreen />)
    expect(screen.getByTestId('axiom-header')).toBeTruthy()
  })

  it('shows search bar on all tabs', () => {
    render(<HomeFeedScreen />)
    expect(screen.getByTestId('search-input')).toBeTruthy()

    // Search stays visible on For You tab
    fireEvent.press(screen.getByTestId('feed-tab-for-you'))
    expect(screen.getByTestId('search-input')).toBeTruthy()
  })

  it('renders unified tab bar with feed and topic tabs', () => {
    render(<HomeFeedScreen />)
    expect(screen.getByTestId('feed-tab-for-you')).toBeTruthy()
    expect(screen.getByTestId('feed-tab-trending')).toBeTruthy()
    expect(screen.getByTestId('feed-tab-latest')).toBeTruthy()
    expect(screen.getByTestId('feed-tab-blindspot')).toBeTruthy()
    expect(screen.getByTestId('feed-tab-politics')).toBeTruthy()
    expect(screen.getByTestId('feed-tab-technology')).toBeTruthy()
  })

  it('renders the edit feed button', () => {
    render(<HomeFeedScreen />)
    expect(screen.getByTestId('edit-feed-button')).toBeTruthy()
  })

  it('renders the guide button in header', () => {
    render(<HomeFeedScreen />)
    expect(screen.getByTestId('guide-button')).toBeTruthy()
  })

  it('does not render a Bookmark icon in the header', () => {
    render(<HomeFeedScreen />)
    expect(screen.queryByLabelText('Saved stories')).toBeNull()
  })

  it('switches active tab when a tab is pressed', () => {
    render(<HomeFeedScreen />)
    fireEvent.press(screen.getByTestId('feed-tab-politics'))
    // Tab should be pressable without errors
    expect(screen.getByTestId('feed-tab-politics')).toBeTruthy()
  })

  it('keeps tab bar visible when switching between tabs', () => {
    render(<HomeFeedScreen />)

    fireEvent.press(screen.getByTestId('feed-tab-for-you'))
    expect(screen.getByTestId('feed-tab-trending')).toBeTruthy()
    expect(screen.getByTestId('feed-tab-politics')).toBeTruthy()

    fireEvent.press(screen.getByTestId('feed-tab-technology'))
    expect(screen.getByTestId('feed-tab-for-you')).toBeTruthy()
    expect(screen.getByTestId('feed-tab-trending')).toBeTruthy()
  })

  it('does not show "No Matches" on For You tab when unauthenticated', () => {
    mockForYouResult.isAuthenticated = false

    render(<HomeFeedScreen />)
    fireEvent.press(screen.getByTestId('feed-tab-for-you'))

    expect(screen.queryByText('No Matches')).toBeNull()

    mockForYouResult.isAuthenticated = true
  })

  it('keeps search bar stable across tab switches (no layout shift)', () => {
    render(<HomeFeedScreen />)

    // Search visible on trending
    expect(screen.getByTestId('search-input')).toBeTruthy()

    // Switch to For You — search still visible (no layout shift)
    fireEvent.press(screen.getByTestId('feed-tab-for-you'))
    expect(screen.getByTestId('search-input')).toBeTruthy()

    // Switch to a topic tab — search still visible
    fireEvent.press(screen.getByTestId('feed-tab-politics'))
    expect(screen.getByTestId('search-input')).toBeTruthy()
  })
})
