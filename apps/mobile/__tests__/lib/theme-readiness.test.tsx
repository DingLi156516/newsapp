/**
 * Root-layout readiness behavior — covers two bugs Codex flagged in review:
 *
 * 1. `SplashScreen.hideAsync()` and `router.replace('/onboarding')` must not
 *    fire until BOTH fonts have loaded AND the theme has hydrated. Otherwise
 *    a fast-loading onboarding storage read on first launch could navigate
 *    before the root navigator is mounted.
 * 2. `useSetTheme()` called before AsyncStorage hydration completes must NOT
 *    be clobbered when the late hydration result resolves with a different
 *    persisted value.
 *
 * Both bugs are first-launch-only, but they're crash-vs-clean-cold-start.
 *
 * The mock strategy: each test creates a controllable Promise that the
 * provider's `AsyncStorage.getItem` resolves with. We swap `AsyncStorage` by
 * `jest.doMock`-ing it at the top of the file so the imported provider
 * sees the controlled instance from the start.
 */

import React from 'react'
import { Text } from 'react-native'

const mockRouterReplace = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
    push: jest.fn(),
    back: jest.fn(),
    dismiss: jest.fn(),
  }),
}))

let pendingGet: { resolve: (v: string | null) => void; promise: Promise<string | null> } | null = null
const setItemCalls: Array<[string, string]> = []

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((_key: string) => {
      let resolve!: (v: string | null) => void
      const promise = new Promise<string | null>((r) => {
        resolve = r
      })
      pendingGet = { resolve, promise }
      return promise
    }),
    setItem: jest.fn((key: string, value: string) => {
      setItemCalls.push([key, value])
      return Promise.resolve()
    }),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
  },
}))

const SplashScreen = require('expo-splash-screen') as typeof import('expo-splash-screen')
const hideAsyncSpy = jest
  .spyOn(SplashScreen, 'hideAsync')
  .mockImplementation(() => Promise.resolve(true))

import { act, render, waitFor } from '@testing-library/react-native'
import {
  ThemeProvider,
  useSetTheme,
  useTheme,
  useThemeHydrated,
} from '@/lib/shared/theme'

beforeEach(() => {
  pendingGet = null
  setItemCalls.length = 0
  mockRouterReplace.mockClear()
  hideAsyncSpy.mockClear()
})

// In-test copy of `ReadinessGate` from app/_layout.tsx — importing the layout
// pulls in fonts and every screen, which is too much for a unit test.
function ReadinessGate({
  fontsLoaded,
  hasSeenOnboarding,
  children,
}: {
  fontsLoaded: boolean
  hasSeenOnboarding: boolean | null
  children: React.ReactNode
}) {
  // Using local require to defer the mocked module resolution.
  const { useRouter } = require('expo-router')
  const router = useRouter()
  const themeHydrated = useThemeHydrated()
  const ready = fontsLoaded && themeHydrated

  React.useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [ready])

  React.useEffect(() => {
    if (ready && hasSeenOnboarding === false) {
      router.replace('/onboarding')
    }
  }, [ready, hasSeenOnboarding, router])

  if (!ready) return null
  return <>{children}</>
}

describe('ReadinessGate', () => {
  it('does not hide splash or replace route before theme hydrates', async () => {
    render(
      <ThemeProvider>
        <ReadinessGate fontsLoaded={true} hasSeenOnboarding={false}>
          <Text testID="ready-children">ready</Text>
        </ReadinessGate>
      </ThemeProvider>,
    )

    // Yield once so any synchronous-looking effects flush.
    await act(async () => {})

    expect(hideAsyncSpy).not.toHaveBeenCalled()
    expect(mockRouterReplace).not.toHaveBeenCalled()

    // Resolve hydration; the gate should now flip ready and fire both effects.
    await act(async () => {
      pendingGet?.resolve(null)
    })

    await waitFor(() => expect(hideAsyncSpy).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith('/onboarding'),
    )
  })

  it('does not redirect when hasSeenOnboarding is true after hydration', async () => {
    render(
      <ThemeProvider>
        <ReadinessGate fontsLoaded={true} hasSeenOnboarding={true}>
          <Text testID="ready-children">ready</Text>
        </ReadinessGate>
      </ThemeProvider>,
    )

    await act(async () => {
      pendingGet?.resolve(null)
    })

    await waitFor(() => expect(hideAsyncSpy).toHaveBeenCalledTimes(1))
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })
})

describe('ThemeProvider hydration race', () => {
  it('does not clobber a user setTheme call that fires before hydration resolves', async () => {
    let captured: string | undefined
    let setter: (n: 'dark' | 'paper') => void = () => {}
    function Probe() {
      captured = useTheme().name
      setter = useSetTheme()
      return <Text>probe</Text>
    }

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    // User picks paper before storage read resolves.
    await act(async () => {
      setter('paper')
    })
    expect(captured).toBe('paper')

    // The persisted value happens to be 'dark' (a different earlier choice).
    // Late hydration must NOT clobber the user's just-made selection.
    await act(async () => {
      pendingGet?.resolve('dark')
    })

    await waitFor(() => expect(captured).toBe('paper'))
  })
})
