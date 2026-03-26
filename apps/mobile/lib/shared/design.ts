/**
 * Shared design tokens for mobile UI — spacing, colors, typography.
 * All components should reference these instead of hardcoding values.
 */

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const

export const TEXT_OPACITY = {
  primary: 1,
  secondary: 0.6,
  tertiary: 0.4,
  muted: 0.35,
} as const

export const GLASS = {
  bg: 'rgba(26, 26, 26, 0.4)',
  bgSm: 'rgba(26, 26, 26, 0.5)',
  bgPill: 'rgba(26, 26, 26, 0.6)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderPill: 'rgba(255, 255, 255, 0.1)',
} as const

export const SEMANTIC = {
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
} as const

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
