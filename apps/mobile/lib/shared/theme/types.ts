/**
 * Theme schema — theme-aware color tokens consumed via `useTheme()`.
 *
 * Theme-invariant tokens (SPACING, FONT, BORDER_RADIUS, ANIMATION, …) stay in
 * `@/lib/shared/design`. Domain color maps (BIAS_COLOR, FACTUALITY colors, …)
 * stay in `@/lib/shared/types` — they represent data, not chrome, and remain
 * theme-invariant by design.
 */

export interface SemanticColor {
  readonly color: string
  readonly bg: string
  readonly border: string
}

export interface Theme {
  readonly name: 'dark' | 'light'

  readonly surface: {
    /** App background — was '#0A0A0A' */
    readonly background: string
    /** Default glass surface — was GLASS.bg */
    readonly glass: string
    /** Small glass surface — was GLASS.bgSm */
    readonly glassSm: string
    /** Pill-shaped glass surface — was GLASS.bgPill */
    readonly glassPill: string
    /** Glass border — was GLASS.border */
    readonly border: string
    /** Pill border — was GLASS.borderPill */
    readonly borderPill: string
  }

  readonly text: {
    /** Primary text — was 'white' / '#fff' */
    readonly primary: string
    /** Secondary text (0.6 opacity on dark) */
    readonly secondary: string
    /** Tertiary text (0.4 opacity on dark) */
    readonly tertiary: string
    /** Muted text (0.35 opacity on dark) */
    readonly muted: string
  }

  readonly semantic: {
    readonly success: SemanticColor
    readonly info: SemanticColor
    readonly warning: SemanticColor
    readonly error: SemanticColor
    readonly primary: SemanticColor
    readonly muted: SemanticColor
  }

  /** BlurView tint passed to expo-blur */
  readonly blurTint: 'light' | 'dark' | 'default'
  /** StatusBar style passed to expo-status-bar */
  readonly statusBarStyle: 'light' | 'dark'
}

export type SemanticRole = keyof Theme['semantic']
