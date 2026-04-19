/**
 * Platform-aware shadow presets.
 *
 * iOS uses `shadow*` props; Android uses `elevation`. Web falls back to `{}`.
 * Glass cards use `sm`, editorial hero uses `md`, bottom-sheet surfaces use `lg`.
 */

import { Platform, type ViewStyle } from 'react-native'

const shadow = (opacity: number, radius: number, y: number, elev: number): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: y },
    },
    android: { elevation: elev },
    default: {},
  }) ?? {}

export const ELEVATION = {
  none: {} as ViewStyle,
  sm: shadow(0.08, 8, 2, 2),
  md: shadow(0.12, 16, 6, 6),
  lg: shadow(0.18, 28, 12, 12),
} as const

export type ElevationKey = keyof typeof ELEVATION
