/**
 * Motion tokens — durations, spring configs, easing, and entry presets.
 *
 * `ENTRY_PRESETS` replaces the copy-pasted
 * `FadeInDown.delay(Math.min(i, 8) * 60).springify().damping(18)` lines
 * scattered across tab files.
 */

import { Easing, FadeIn, FadeInDown, SlideInDown, ZoomIn } from 'react-native-reanimated'

export const DURATION = {
  fast: 150,
  base: 200,
  slow: 300,
  slower: 400,
} as const

export const SPRING = {
  stiff: { stiffness: 300, damping: 30 },
  bouncy: { stiffness: 200, damping: 15 },
  snappy: { stiffness: 260, damping: 22 },
} as const

export const EASE = {
  inOut: Easing.inOut(Easing.cubic),
  out: Easing.out(Easing.cubic),
} as const

const STAGGER_STEP = 60
const STAGGER_MAX_STEPS = 8

export const ENTRY_PRESETS = {
  staggered: (index: number) =>
    FadeInDown.delay(Math.min(index, STAGGER_MAX_STEPS) * STAGGER_STEP)
      .springify()
      .damping(18),
  heroFade: FadeIn.duration(DURATION.slower),
  modalSlide: SlideInDown.springify().damping(20),
  pillRipple: ZoomIn.duration(DURATION.base).easing(EASE.out),
} as const

export type DurationKey = keyof typeof DURATION
export type SpringKey = keyof typeof SPRING
