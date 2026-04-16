/**
 * ThemeProvider — runtime-switchable theme with AsyncStorage persistence.
 *
 * The provider exposes three contexts so consumers re-render only on what they
 * actually use:
 *   - ThemeContext     → the resolved Theme
 *   - SetThemeContext  → stable setter for the theme name
 *   - HydratedContext  → boolean, true once persisted choice has loaded
 *
 * A `theme` prop override remains for tests; when supplied, the setter becomes
 * a no-op (calling it throws in dev) so a forced theme can never silently
 * persist a user choice.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { darkTheme } from './dark'
import { paperTheme } from './paper'
import type { Theme, ThemeName } from './types'

const STORAGE_KEY = 'axiom.theme'

const THEMES: Record<ThemeName, Theme> = {
  dark: darkTheme,
  paper: paperTheme,
}

const noopSetter = (_name: ThemeName) => {
  if (__DEV__) {
    throw new Error(
      'useSetTheme(): theme is forced via ThemeProvider `theme` prop and cannot be set.',
    )
  }
}

const ThemeContext = createContext<Theme>(darkTheme)
const SetThemeContext = createContext<(name: ThemeName) => void>(noopSetter)
const HydratedContext = createContext<boolean>(true)

interface ThemeProviderProps {
  /** Force a specific theme (tests). When provided, persistence is bypassed. */
  readonly theme?: Theme
  readonly children: ReactNode
}

export function ThemeProvider({ theme: forced, children }: ThemeProviderProps) {
  const [name, setName] = useState<ThemeName>('dark')
  const [hydrated, setHydrated] = useState<boolean>(forced !== undefined)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    if (forced !== undefined) return
    let cancelled = false
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled || !isMounted.current) return
        if (stored === 'dark' || stored === 'paper') {
          setName(stored)
        }
        setHydrated(true)
      })
      .catch(() => {
        if (cancelled || !isMounted.current) return
        setHydrated(true)
      })
    return () => {
      cancelled = true
    }
  }, [forced])

  const setTheme = useCallback((next: ThemeName) => {
    setName(next)
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      /* swallow — UI already reflects the change */
    })
  }, [])

  const resolvedTheme = forced ?? THEMES[name]
  const setter = forced !== undefined ? noopSetter : setTheme
  const isHydrated = forced !== undefined ? true : hydrated

  const themeValue = useMemo(() => resolvedTheme, [resolvedTheme])

  return (
    <ThemeContext.Provider value={themeValue}>
      <SetThemeContext.Provider value={setter}>
        <HydratedContext.Provider value={isHydrated}>
          {children}
        </HydratedContext.Provider>
      </SetThemeContext.Provider>
    </ThemeContext.Provider>
  )
}

export function useTheme(): Theme {
  return useContext(ThemeContext)
}

export function useSetTheme(): (name: ThemeName) => void {
  return useContext(SetThemeContext)
}

export function useThemeHydrated(): boolean {
  return useContext(HydratedContext)
}
