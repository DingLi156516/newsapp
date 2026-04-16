/**
 * Settings → Appearance integration test.
 *
 * Renders the Settings screen with a real ThemeProvider, taps the Paper
 * radio, and asserts the screen's SafeAreaView re-renders with the paper
 * background color. Also verifies guests see the theme pills + sign-in CTA.
 */

import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import SettingsScreen from '@/app/settings'
import { ThemeProvider, paperTheme } from '@/lib/shared/theme'

const mockUseAuth = jest.fn()
jest.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
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

beforeEach(async () => {
  await AsyncStorage.clear()
  mockUseAuth.mockReset()
})

describe('Settings → Appearance', () => {
  it('switches the screen background to paper when Paper is tapped', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } })

    const { getByTestId } = render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>,
    )

    // Wait for hydration → defaults to dark, screen visible.
    await waitFor(() => expect(getByTestId('settings-screen')).toBeTruthy())

    fireEvent.press(getByTestId('setting-theme-paper'))

    await waitFor(() => {
      const screen = getByTestId('settings-screen')
      const flatStyle = Array.isArray(screen.props.style)
        ? Object.assign({}, ...screen.props.style)
        : screen.props.style
      expect(flatStyle.backgroundColor).toBe(paperTheme.surface.background)
    })
  })

  it('shows appearance pills and a sign-in CTA for guests', async () => {
    mockUseAuth.mockReturnValue({ user: null })

    const { getByTestId, queryByTestId } = render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>,
    )

    await waitFor(() => expect(getByTestId('settings-screen')).toBeTruthy())

    // Appearance pills render for everyone.
    expect(getByTestId('setting-theme-dark')).toBeTruthy()
    expect(getByTestId('setting-theme-paper')).toBeTruthy()

    // Guest CTA is visible.
    expect(getByTestId('settings-sign-in-cta')).toBeTruthy()
    expect(getByTestId('settings-sign-in-button')).toBeTruthy()

    // Auth-only sections are absent.
    expect(queryByTestId('setting-topic-politics')).toBeNull()
    expect(queryByTestId('setting-perspective-all')).toBeNull()
    expect(queryByTestId('setting-factuality-mixed')).toBeNull()
  })
})
