/**
 * Theme module barrel — public API for theme-aware tokens.
 *
 * Consumers should import from `@/lib/shared/theme`:
 *   import { useTheme } from '@/lib/shared/theme'
 *
 * Theme-invariant tokens (SPACING, FONT, BORDER_RADIUS, ANIMATION, …) remain
 * in `@/lib/shared/design`.
 */

export type { Theme, SemanticColor, SemanticRole } from './types'
export { darkTheme } from './dark'
export { ThemeProvider, useTheme } from './ThemeProvider'
