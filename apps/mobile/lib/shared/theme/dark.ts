/**
 * Dark theme — current production values. These values are the visual
 * baseline; any change here will shift the dark UI.
 */

import type { Theme } from './types'

export const darkTheme: Theme = {
  name: 'dark',

  surface: {
    background: '#0A0A0A',
    glass: 'rgba(26, 26, 26, 0.4)',
    glassSm: 'rgba(26, 26, 26, 0.5)',
    glassPill: 'rgba(26, 26, 26, 0.6)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderPill: 'rgba(255, 255, 255, 0.1)',
  },

  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.6)',
    tertiary: 'rgba(255, 255, 255, 0.4)',
    muted: 'rgba(255, 255, 255, 0.35)',
  },

  semantic: {
    success: {
      color: '#22c55e',
      bg: 'rgba(34, 197, 94, 0.12)',
      border: 'rgba(34, 197, 94, 0.25)',
    },
    info: {
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.25)',
    },
    warning: {
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.25)',
    },
    error: {
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.25)',
    },
    primary: {
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.12)',
      border: 'rgba(139, 92, 246, 0.25)',
    },
    muted: {
      color: 'rgba(255, 255, 255, 0.35)',
      bg: 'rgba(255, 255, 255, 0.06)',
      border: 'rgba(255, 255, 255, 0.1)',
    },
  },

  blurTint: 'dark',
  statusBarStyle: 'light',
  texture: { kind: 'none', intensity: 0 },
  inkRgb: '255, 255, 255',
}
