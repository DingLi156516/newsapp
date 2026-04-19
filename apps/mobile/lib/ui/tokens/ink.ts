/**
 * Named opacities for `rgba(${theme.inkRgb}, X)` composition.
 *
 * Replaces inline magic numbers (0.03 / 0.05 / 0.06 / 0.10 / 0.15) found
 * across every tab file. The values are intentionally ordered — consumers
 * can rely on `INK_TINT.whisper < INK_TINT.subtle < …`.
 */
export const INK_TINT = {
  whisper: 0.03,
  subtle: 0.05,
  soft: 0.06,
  standard: 0.1,
  strong: 0.15,
  bold: 0.25,
} as const

export type InkTintKey = keyof typeof INK_TINT
