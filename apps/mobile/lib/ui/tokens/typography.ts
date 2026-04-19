/**
 * Editorial Glass type system.
 *
 * DM Serif Display for display/title variants, Inter for everything else.
 * `TEXT_STYLES` entries are full `TextStyle`-compatible objects ready for
 * `<Text style={TEXT_STYLES.display}>` — consumers add color via `useTheme()`.
 */

import type { TextStyle } from 'react-native'

export const FONT_FAMILY = {
  display: 'DMSerifDisplay',
  body: 'Inter',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
} as const

export type FontFamilyKey = keyof typeof FONT_FAMILY

export const TEXT_STYLES = {
  hero: {
    fontFamily: FONT_FAMILY.display,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.6,
  },
  display: {
    fontFamily: FONT_FAMILY.display,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  title: {
    fontFamily: FONT_FAMILY.display,
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  heading: {
    fontFamily: FONT_FAMILY.semibold,
    fontSize: 15,
    lineHeight: 22,
  },
  headingSm: {
    fontFamily: FONT_FAMILY.semibold,
    fontSize: 13,
    lineHeight: 20,
  },
  body: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 14,
    lineHeight: 22,
  },
  bodySm: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 13,
    lineHeight: 20,
  },
  caption: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    lineHeight: 18,
  },
  small: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  overline: {
    fontFamily: FONT_FAMILY.medium,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  badge: {
    fontFamily: FONT_FAMILY.semibold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.3,
  },
} as const satisfies Record<string, TextStyle>

export type TextVariant = keyof typeof TEXT_STYLES
