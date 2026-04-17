import React from 'react'
import { render, screen } from '@testing-library/react-native'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, dismiss: jest.fn() }),
}))

// Use mockReturnValue pattern to change per-test
const mockUseAuth = jest.fn()
jest.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockUseBiasProfile = jest.fn()
jest.mock('@/lib/hooks/use-bias-profile', () => ({
  useBiasProfile: () => mockUseBiasProfile(),
}))

const mockUseSuggestions = jest.fn()
jest.mock('@/lib/hooks/use-suggestions', () => ({
  useSuggestions: () => mockUseSuggestions(),
}))

jest.mock('@/lib/hooks/use-bookmarks', () => ({
  useBookmarks: () => ({ toggle: jest.fn(), isBookmarked: () => false }),
}))

jest.mock('@/lib/hooks/use-reading-history', () => ({
  useReadingHistory: () => ({ readCount: 42 }),
}))

import ProfileScreen from '@/app/(tabs)/profile'

const mockProfile = {
  userDistribution: [
    { bias: 'left', percentage: 60 },
    { bias: 'center', percentage: 30 },
    { bias: 'right', percentage: 10 },
  ],
  overallDistribution: [
    { bias: 'left', percentage: 33 },
    { bias: 'center', percentage: 34 },
    { bias: 'right', percentage: 33 },
  ],
  totalStoriesRead: 42,
  blindspots: ['right'],
  dominantBias: 'left',
}

function setupAuthenticated(profile = mockProfile) {
  mockUseAuth.mockReturnValue({
    user: { id: 'u1', email: 'test@example.com' },
    signOut: jest.fn(),
    isLoading: false,
  })
  mockUseBiasProfile.mockReturnValue({ profile, isLoading: false })
  mockUseSuggestions.mockReturnValue({ suggestions: [], isLoading: false })
}

function setupUnauthenticated() {
  mockUseAuth.mockReturnValue({ user: null, signOut: jest.fn(), isLoading: false })
  mockUseBiasProfile.mockReturnValue({ profile: null, isLoading: false })
  mockUseSuggestions.mockReturnValue({ suggestions: [], isLoading: false })
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('unauthenticated', () => {
    it('shows quick action buttons (History, Saved, and Guide)', () => {
      setupUnauthenticated()
      render(<ProfileScreen />)
      expect(screen.getByText('History')).toBeTruthy()
      expect(screen.getByText('Saved')).toBeTruthy()
      expect(screen.getByText('Guide')).toBeTruthy()
    })

    it('shows sign-in CTA card', () => {
      setupUnauthenticated()
      render(<ProfileScreen />)
      expect(screen.getByTestId('sign-in-cta')).toBeTruthy()
      expect(screen.getByText('Unlock Bias Calibration')).toBeTruthy()
      expect(screen.getByText('Sign In')).toBeTruthy()
    })

    it('shows Guest as subtitle', () => {
      setupUnauthenticated()
      render(<ProfileScreen />)
      expect(screen.getByText('Guest')).toBeTruthy()
    })

    it('does not show Sign Out button', () => {
      setupUnauthenticated()
      render(<ProfileScreen />)
      expect(screen.queryByText('Sign Out')).toBeNull()
    })

    it('does not show Bias Calibration detail', () => {
      setupUnauthenticated()
      render(<ProfileScreen />)
      expect(screen.queryByTestId('bias-banner')).toBeNull()
    })

    it('does not show Suggestions section', () => {
      setupUnauthenticated()
      render(<ProfileScreen />)
      expect(screen.queryByText('Suggested For You')).toBeNull()
    })

    it('shows Dashboard header', () => {
      setupUnauthenticated()
      render(<ProfileScreen />)
      expect(screen.getByText('Dashboard')).toBeTruthy()
    })
  })

  describe('authenticated', () => {
    it('shows banner with "Bias Calibration" when authenticated', () => {
      setupAuthenticated()
      render(<ProfileScreen />)
      expect(screen.getByText('Bias Calibration')).toBeTruthy()
    })

    it('shows Stories Read stat card for authenticated users', () => {
      setupAuthenticated()
      render(<ProfileScreen />)
      expect(screen.getByText('Stories Read')).toBeTruthy()
    })

    it('shows Blindspots stat card for authenticated users', () => {
      setupAuthenticated()
      render(<ProfileScreen />)
      expect(screen.getByText('Blindspots')).toBeTruthy()
    })

    it('shows spectrum comparison section', () => {
      setupAuthenticated()
      render(<ProfileScreen />)
      expect(screen.getByText('Spectrum Comparison')).toBeTruthy()
    })

    it('shows detailed breakdown with dominant bias', () => {
      setupAuthenticated()
      render(<ProfileScreen />)
      expect(screen.getByText('Detailed Breakdown')).toBeTruthy()
      expect(screen.getByText('Dominant: Left')).toBeTruthy()
    })

    it('shows blindspots section with explanation', () => {
      setupAuthenticated()
      render(<ProfileScreen />)
      expect(screen.getByText('Your Blindspots')).toBeTruthy()
      expect(screen.getByText(/You read significantly less/)).toBeTruthy()
    })

    it('shows suggestions section header', () => {
      setupAuthenticated()
      render(<ProfileScreen />)
      expect(screen.getByText('Suggested For You')).toBeTruthy()
    })

    it('shows sign-out button', () => {
      setupAuthenticated()
      render(<ProfileScreen />)
      expect(screen.getByText('Sign Out')).toBeTruthy()
    })

    it('shows nav buttons', () => {
      setupAuthenticated()
      render(<ProfileScreen />)
      expect(screen.getByText('History')).toBeTruthy()
      expect(screen.getByText('Saved')).toBeTruthy()
    })

    it('shows user email in header', () => {
      setupAuthenticated()
      render(<ProfileScreen />)
      expect(screen.getByText('test@example.com')).toBeTruthy()
    })

    it('shows empty state when no profile data', () => {
      setupAuthenticated(null as any)
      render(<ProfileScreen />)
      expect(screen.getByText('Start reading stories to build your bias profile!')).toBeTruthy()
    })
  })
})
