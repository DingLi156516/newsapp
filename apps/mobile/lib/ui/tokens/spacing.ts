/**
 * Spacing scale — 4pt rhythm.
 *
 * Values match the legacy `SPACING` export in `lib/shared/design.ts`, which
 * re-exports this module for back-compat.
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const

export type SpacingKey = keyof typeof SPACING
