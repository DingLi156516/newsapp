/**
 * Border-radius scale. `xxl` is new for the editorial hero card.
 *
 * Replaces `BORDER_RADIUS` in `lib/shared/design.ts`. The legacy name is
 * re-exported from that module for back-compat.
 */
export const RADIUS = {
  xs: 6,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 9999,
} as const

export type RadiusKey = keyof typeof RADIUS
