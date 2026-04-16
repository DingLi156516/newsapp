/**
 * Shared design tokens for mobile UI.
 *
 * Theme-invariant tokens live here: spacing, typography, badges, border radii,
 * animation curves, touch targets. Theme-aware color tokens (surface, text,
 * semantic) have moved to `@/lib/shared/theme`; use `useTheme()` in components.
 *
 * `GLASS`, `SEMANTIC`, and `TEXT_OPACITY` remain as deprecated re-exports
 * sourced from the dark theme so non-migrated components continue to render
 * identically. Migrate to `useTheme()` when you touch one of these for other
 * reasons — see `apps/mobile/lib/shared/theme/README.md`.
 */

import { darkTheme } from './theme/dark'

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const

/**
 * Numeric opacity levels for `rgba(255,255,255, X)` composition.
 *
 * @deprecated Prefer `useTheme().text.*` for full color strings. Kept as
 *   numeric opacities for call sites that still interpolate them manually.
 */
export const TEXT_OPACITY = {
  primary: 1,
  secondary: 0.6,
  tertiary: 0.4,
  muted: 0.35,
} as const

/**
 * Glass surface colors.
 *
 * @deprecated Use `useTheme().surface.*` instead. Re-exported from `darkTheme`
 *   for back-compat during the theme migration.
 */
export const GLASS = {
  bg: darkTheme.surface.glass,
  bgSm: darkTheme.surface.glassSm,
  bgPill: darkTheme.surface.glassPill,
  border: darkTheme.surface.border,
  borderPill: darkTheme.surface.borderPill,
} as const

/**
 * Semantic status colors.
 *
 * @deprecated Use `useTheme().semantic.*` instead. Re-exported from `darkTheme`
 *   for back-compat during the theme migration.
 */
export const SEMANTIC = darkTheme.semantic

export type SemanticRole = keyof typeof SEMANTIC

/** @deprecated Use SEMANTIC.warning / SEMANTIC.error instead */
export const ACCENT = {
  amber: SEMANTIC.warning.color,
  amberBg: SEMANTIC.warning.bg,
  amberBorder: SEMANTIC.warning.border,
  red: SEMANTIC.error.color,
} as const

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

export const TOUCH_TARGET = {
  min: 44,
  hitSlop: 12,
} as const

export const BORDER_RADIUS = {
  xs: 6,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 9999,
} as const

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
