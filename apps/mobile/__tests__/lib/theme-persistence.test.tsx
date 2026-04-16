/**
 * ThemeProvider persistence + hydration behavior.
 *
 * AsyncStorage is mocked in jest.setup.ts to use the official in-memory mock,
 * so writes round-trip across renders within a test.
 */

import React from 'react'
import { Text, View } from 'react-native'
import { act, render, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  ThemeProvider,
  darkTheme,
  paperTheme,
  useTheme,
  useSetTheme,
  useThemeHydrated,
} from '@/lib/shared/theme'

const STORAGE_KEY = 'axiom.theme'

beforeEach(async () => {
  await AsyncStorage.clear()
})

describe('ThemeProvider persistence', () => {
  it('hydrates the persisted choice on mount', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'paper')

    let captured: string | undefined
    function Probe() {
      captured = useTheme().name
      return <Text>probe</Text>
    }

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    await waitFor(() => expect(captured).toBe('paper'))
  })

  it('falls back to dark when no value is persisted', async () => {
    let captured: string | undefined
    function Probe() {
      captured = useTheme().name
      return <Text>probe</Text>
    }

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    await waitFor(() => expect(captured).toBe('dark'))
  })

  it('persists setTheme calls through AsyncStorage', async () => {
    let setter: (name: 'dark' | 'paper') => void = () => {}
    let captured: string | undefined

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

    await waitFor(() => expect(captured).toBe('dark'))

    await act(async () => {
      setter('paper')
    })

    expect(captured).toBe('paper')
    await waitFor(async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY)
      expect(stored).toBe('paper')
    })
  })

  it('useThemeHydrated() flips to true after async hydration', async () => {
    const observed: boolean[] = []
    function Probe() {
      observed.push(useThemeHydrated())
      return <Text>probe</Text>
    }

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    await waitFor(() => expect(observed[observed.length - 1]).toBe(true))
    expect(observed[0]).toBe(false)
  })
})

describe('ThemeProvider setter identity', () => {
  it('useSetTheme reference is stable across unrelated re-renders', async () => {
    const captured: Array<(n: 'dark' | 'paper') => void> = []
    function Probe({ flag }: { flag: number }) {
      captured.push(useSetTheme())
      return <Text>{flag}</Text>
    }

    function Host() {
      const [flag, setFlag] = React.useState(0)
      return (
        <View>
          <Probe flag={flag} />
          <Text onPress={() => setFlag((n) => n + 1)}>bump</Text>
        </View>
      )
    }

    const { getByText } = render(
      <ThemeProvider>
        <Host />
      </ThemeProvider>,
    )

    await waitFor(() => expect(captured.length).toBeGreaterThanOrEqual(1))

    await act(async () => {
      getByText('bump').props.onPress()
    })

    expect(captured.length).toBeGreaterThanOrEqual(2)
    expect(captured[0]).toBe(captured[captured.length - 1])
  })
})

describe('ThemeProvider forced theme override', () => {
  it('returns the forced theme regardless of persisted value', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'paper')

    let captured: typeof darkTheme | undefined
    function Probe() {
      captured = useTheme()
      return <Text>probe</Text>
    }

    render(
      <ThemeProvider theme={darkTheme}>
        <Probe />
      </ThemeProvider>,
    )

    expect(captured).toBe(darkTheme)
  })

  it('exposes a no-op setter that throws in dev when forced', () => {
    let setter: (name: 'dark' | 'paper') => void = () => {}
    function Probe() {
      setter = useSetTheme()
      return <Text>probe</Text>
    }

    render(
      <ThemeProvider theme={paperTheme}>
        <Probe />
      </ThemeProvider>,
    )

    expect(() => setter('dark')).toThrow(/forced via ThemeProvider/i)
  })

  it('reports hydrated=true immediately when forced', () => {
    const observed: boolean[] = []
    function Probe() {
      observed.push(useThemeHydrated())
      return <Text>probe</Text>
    }

    render(
      <ThemeProvider theme={darkTheme}>
        <Probe />
      </ThemeProvider>,
    )

    expect(observed.every((v) => v === true)).toBe(true)
  })
})
