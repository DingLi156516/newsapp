/**
 * Paper theme — Kindle-Sepia-style parchment ground, ink-brown text,
 * fine-grain surface texture overlay.
 *
 * Translucent glass surfaces stay white-on-cream (rather than tinted brown)
 * so BlurView still reads as a frosted pane on iOS. Border opacities are
 * bumped versus the dark theme (0.20 vs 0.08) — light-on-light needs more
 * separation than light-on-dark to avoid washing out.
 */

import type { Theme } from './types'

export const paperTheme: Theme = {
  name: 'paper',

  surface: {
    background: '#FBF0D9',
    glass: 'rgba(255, 255, 255, 0.75)',
    glassSm: 'rgba(255, 255, 255, 0.82)',
    glassPill: 'rgba(255, 255, 255, 0.70)',
    border: 'rgba(95, 75, 50, 0.20)',
    borderPill: 'rgba(95, 75, 50, 0.22)',
  },

  text: {
    primary: '#5F4B32',
    secondary: 'rgba(95, 75, 50, 0.72)',
    tertiary: 'rgba(95, 75, 50, 0.50)',
    muted: 'rgba(95, 75, 50, 0.35)',
  },

  semantic: {
    success: {
      color: '#3F7D4A',
      bg: 'rgba(63, 125, 74, 0.10)',
      border: 'rgba(63, 125, 74, 0.25)',
    },
    info: {
      color: '#2F6A9E',
      bg: 'rgba(47, 106, 158, 0.10)',
      border: 'rgba(47, 106, 158, 0.25)',
    },
    warning: {
      color: '#B87333',
      bg: 'rgba(184, 115, 51, 0.12)',
      border: 'rgba(184, 115, 51, 0.30)',
    },
    error: {
      color: '#9B2D2D',
      bg: 'rgba(155, 45, 45, 0.10)',
      border: 'rgba(155, 45, 45, 0.25)',
    },
    primary: {
      color: '#6B4E8F',
      bg: 'rgba(107, 78, 143, 0.10)',
      border: 'rgba(107, 78, 143, 0.25)',
    },
    muted: {
      color: 'rgba(95, 75, 50, 0.45)',
      bg: 'rgba(95, 75, 50, 0.06)',
      border: 'rgba(95, 75, 50, 0.15)',
    },
  },

  blurTint: 'light',
  statusBarStyle: 'dark',
  texture: {
    kind: 'grain',
    intensity: 0.1,
    asset: require('@/assets/images/paper-grain.png'),
  },
  inkRgb: '95, 75, 50',
}
