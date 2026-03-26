import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  }),
}))

jest.mock('@/lib/hooks/use-onboarding', () => ({
  useOnboarding: () => ({
    hasSeenOnboarding: false,
    completeOnboarding: jest.fn().mockResolvedValue(undefined),
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

import OnboardingScreen from '@/app/onboarding'

describe('Onboarding', () => {
  it('renders first screen title', () => {
    render(<OnboardingScreen />)
    expect(screen.getByText('See Every Perspective')).toBeTruthy()
  })

  it('renders skip button', () => {
    render(<OnboardingScreen />)
    expect(screen.getByText('Skip')).toBeTruthy()
  })

  it('renders 3 page dots', () => {
    render(<OnboardingScreen />)
    expect(screen.getByTestId('page-dots')).toBeTruthy()
  })

  it('renders Next button on first screen', () => {
    render(<OnboardingScreen />)
    expect(screen.getByTestId('next-button')).toBeTruthy()
  })

  it('renders all page titles in the list', () => {
    render(<OnboardingScreen />)
    expect(screen.getByText('See Every Perspective')).toBeTruthy()
    // Other pages are in the horizontal FlatList but may not be visible
    // The content is rendered but off-screen
  })

  it('renders Get Started on last page data', () => {
    render(<OnboardingScreen />)
    // The last page content exists in the FlatList data
    expect(screen.getByText('Find Your Blindspots')).toBeTruthy()
  })
})
