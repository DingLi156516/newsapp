import React from 'react'
import { render, screen } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}))

const mockUseBookmarks = jest.fn()
jest.mock('@/lib/hooks/use-bookmarks', () => ({
  useBookmarks: () => mockUseBookmarks(),
}))

jest.mock('@/lib/hooks/use-stories', () => ({
  useStories: () => ({ stories: [], isLoading: false }),
}))

jest.mock('@/lib/hooks/use-reading-history', () => ({
  useReadingHistory: () => ({ isRead: () => false }),
}))

jest.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ showToast: jest.fn(), hideToast: jest.fn(), toast: null }),
}))

import SavedScreen from '@/app/saved'

describe('SavedScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows empty state when no bookmarks (unauthenticated)', () => {
    mockUseBookmarks.mockReturnValue({
      isBookmarked: () => false,
      toggle: jest.fn(),
      bookmarkedIds: new Set(),
      count: 0,
    })

    render(<SavedScreen />)
    expect(screen.getByText('Saved Stories')).toBeTruthy()
    expect(screen.getByText('No Saved Stories')).toBeTruthy()
  })

  it('shows empty state when authenticated with no bookmarks', () => {
    mockUseBookmarks.mockReturnValue({
      isBookmarked: () => false,
      toggle: jest.fn(),
      bookmarkedIds: new Set(),
      count: 0,
    })

    render(<SavedScreen />)
    expect(screen.getByText('Saved Stories')).toBeTruthy()
    expect(screen.getByText('No Saved Stories')).toBeTruthy()
  })

  it('renders back button and header', () => {
    mockUseBookmarks.mockReturnValue({
      isBookmarked: () => false,
      toggle: jest.fn(),
      bookmarkedIds: new Set(),
      count: 0,
    })

    render(<SavedScreen />)
    expect(screen.getByTestId('back-button')).toBeTruthy()
    expect(screen.getByText('Saved Stories')).toBeTruthy()
  })

  it('does not show sign-in prompt (no auth gate)', () => {
    mockUseBookmarks.mockReturnValue({
      isBookmarked: () => false,
      toggle: jest.fn(),
      bookmarkedIds: new Set(),
      count: 0,
    })

    render(<SavedScreen />)
    expect(screen.queryByText('Sign in to save stories.')).toBeNull()
  })
})
