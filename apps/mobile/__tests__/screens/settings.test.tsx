import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

const mockUpdatePreferences = jest.fn()

jest.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))

jest.mock('@/lib/hooks/use-preferences', () => ({
  usePreferences: () => ({
    preferences: {
      followed_topics: ['politics', 'technology'],
      default_perspective: 'all',
      factuality_minimum: 'mixed',
      blindspot_digest_enabled: false,
    },
    updatePreferences: mockUpdatePreferences,
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

import SettingsScreen from '@/app/settings'

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders Followed Topics section', () => {
    render(<SettingsScreen />)
    expect(screen.getByText('Followed Topics')).toBeTruthy()
    expect(screen.getByTestId('setting-topic-politics')).toBeTruthy()
    expect(screen.getByTestId('setting-topic-technology')).toBeTruthy()
  })

  it('renders Default Perspective section with all 4 options', () => {
    render(<SettingsScreen />)
    expect(screen.getByText('Default Perspective')).toBeTruthy()
    expect(screen.getByTestId('setting-perspective-all')).toBeTruthy()
    expect(screen.getByTestId('setting-perspective-left')).toBeTruthy()
    expect(screen.getByTestId('setting-perspective-center')).toBeTruthy()
    expect(screen.getByTestId('setting-perspective-right')).toBeTruthy()
  })

  it('renders Minimum Factuality section with 3 options', () => {
    render(<SettingsScreen />)
    expect(screen.getByText('Minimum Factuality')).toBeTruthy()
    expect(screen.getByTestId('setting-factuality-mixed')).toBeTruthy()
    expect(screen.getByTestId('setting-factuality-high')).toBeTruthy()
    expect(screen.getByTestId('setting-factuality-very-high')).toBeTruthy()
  })

  it('renders Blindspot Digest toggle', () => {
    render(<SettingsScreen />)
    expect(screen.getByText('Blindspot Digest')).toBeTruthy()
  })

  it('calls updatePreferences when perspective is changed', () => {
    render(<SettingsScreen />)

    fireEvent.press(screen.getByTestId('setting-perspective-left'))
    expect(mockUpdatePreferences).toHaveBeenCalledWith({ default_perspective: 'left' })
  })

  it('calls updatePreferences when factuality is changed', () => {
    render(<SettingsScreen />)

    fireEvent.press(screen.getByTestId('setting-factuality-high'))
    expect(mockUpdatePreferences).toHaveBeenCalledWith({ factuality_minimum: 'high' })
  })

  it('calls updatePreferences when topic is toggled off', () => {
    render(<SettingsScreen />)

    fireEvent.press(screen.getByTestId('setting-topic-politics'))
    expect(mockUpdatePreferences).toHaveBeenCalledWith({ followed_topics: ['technology'] })
  })

  it('calls updatePreferences when topic is toggled on', () => {
    render(<SettingsScreen />)

    fireEvent.press(screen.getByTestId('setting-topic-world'))
    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      followed_topics: ['politics', 'technology', 'world'],
    })
  })
})
