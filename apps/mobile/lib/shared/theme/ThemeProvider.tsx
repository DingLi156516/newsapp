/**
 * ThemeProvider + useTheme() — React Context for theme-aware tokens.
 *
 * Current behavior: fixed to the dark theme. The provider accepts an optional
 * `theme` prop so a light/alternate theme can be swapped in without touching
 * consumers once design specs land. Consumers outside any provider fall back
 * to `darkTheme`, which keeps unit tests that render components in isolation
 * working without extra plumbing.
 */

import { createContext, useContext, type ReactNode } from 'react'
import { darkTheme } from './dark'
import type { Theme } from './types'

const ThemeContext = createContext<Theme>(darkTheme)

interface ThemeProviderProps {
  readonly theme?: Theme
  readonly children: ReactNode
}

export function ThemeProvider({ theme = darkTheme, children }: ThemeProviderProps) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  return useContext(ThemeContext)
}
