/**
 * Theme schema — theme-aware color tokens consumed via `useTheme()`.
 *
 * Theme-invariant tokens (SPACING, FONT, BORDER_RADIUS, ANIMATION, …) stay in
 * `@/lib/shared/design`. Domain color maps (BIAS_COLOR, FACTUALITY colors, …)
 * stay in `@/lib/shared/types` — they represent data, not chrome, and remain
 * theme-invariant by design.
 */

import type { ImageSourcePropType } from 'react-native'

export type ThemeName = 'dark' | 'paper'

export interface SemanticColor {
  readonly color: string
  readonly bg: string
  readonly border: string
}

export interface ThemeTexture {
  /** 'none' draws nothing; 'grain' tiles an image at the given intensity. */
  readonly kind: 'none' | 'grain'
  /** Overlay opacity (0–1). Ignored when kind === 'none'. */
  readonly intensity: number
  /** Tileable image asset for the overlay. Required when kind === 'grain'. */
  readonly asset?: ImageSourcePropType
}

export interface Theme {
  readonly name: ThemeName

  readonly surface: {
    /** App background. */
    readonly background: string
    /** Default glass surface. */
    readonly glass: string
    /** Small glass surface. */
    readonly glassSm: string
    /** Pill-shaped glass surface. */
    readonly glassPill: string
    /** Glass border. */
    readonly border: string
    /** Pill border. */
    readonly borderPill: string
  }

  readonly text: {
    /** Primary text. */
    readonly primary: string
    /** Secondary text (0.6 opacity on dark). */
    readonly secondary: string
    /** Tertiary text (0.4 opacity on dark). */
    readonly tertiary: string
    /** Muted text (0.35 opacity on dark). */
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
  /** Optional surface texture overlay (e.g. paper grain). */
  readonly texture: ThemeTexture
  /**
   * Comma-separated RGB triplet for the theme's monochrome ink color, used to
   * compose `rgba(${inkRgb}, opacity)` for tints (e.g. monochrome bias bars
   * that modulate opacity over a single base color). On dark this is white;
   * on paper, the ink-brown text color.
   */
  readonly inkRgb: string
}

export type SemanticRole = keyof Theme['semantic']
