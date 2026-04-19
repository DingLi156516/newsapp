/**
 * Shared design tokens for mobile UI.
 *
 * SPACING, BORDER_RADIUS, and TOUCH_TARGET are re-exported from
 * `@/lib/ui/tokens` for source-compat during the migration; new code should
 * import directly from `@/lib/ui`.
 *
 * Theme-aware color tokens (surface, text, semantic) live in
 * `@/lib/shared/theme`; consume them with `useTheme()` at render time.
 */

import { RADIUS, SPACING as UI_SPACING, TOUCH_TARGET as UI_TOUCH_TARGET } from '@/lib/ui/tokens'

export const SPACING = UI_SPACING

export const BADGE = {
  paddingH: 10,
  paddingV: 4,
  fontSize: 11,
  borderRadius: 9999,
} as const

export const FONT = {
  headline: { family: 'DMSerifDisplay', size: 20, lineHeight: 28 },
  headlineLg: { family: 'DMSerifDisplay', size: 26, lineHeight: 34 },
  body: { family: 'Inter', size: 14 },
  caption: { family: 'Inter', size: 12 },
  small: { family: 'Inter', size: 11 },
  tiny: { family: 'Inter', size: 10 },
} as const

export const TOUCH_TARGET = UI_TOUCH_TARGET

export const BORDER_RADIUS = RADIUS

export const SITE_URL =
  process.env.EXPO_PUBLIC_SITE_URL ?? 'https://axiom-news.vercel.app'

export const FACTUALITY = {
  'very-high': { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)', fill: 1.0 },
  'high':      { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.25)', fill: 0.8 },
  'mixed':     { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', fill: 0.6 },
  'low':       { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)', fill: 0.4 },
  'very-low':  { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', fill: 0.2 },
} as const

export const ANIMATION = {
  springStiff: { stiffness: 300, damping: 30 },
  springBouncy: { stiffness: 200, damping: 15 },
  fadeIn: 200,
  fadeOut: 100,
  pressScale: 0.97,
} as const
