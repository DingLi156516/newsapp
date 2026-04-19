/**
 * Surface — wraps `GlassView` with support for a `solid` variant, shadow
 * elevation, and a left-border accent (used by source cards). The `glow`
 * prop forwards directly to `GlassView` for the ambient top-edge gradient.
 *
 * iOS shadows get clipped when applied to a view with `overflow: 'hidden'`
 * (which `GlassView` always sets). To keep glass elevations visible, the
 * shadow plus any layout props from `style` hoist onto an outer wrapper, and
 * the remaining visual props stay on the glass. Call sites don't need to
 * care — `<Surface style={{ flex: 1, padding: 12 }} elevation="sm" />`
 * still behaves as before.
 */

import { StyleSheet, View, type StyleProp, type ViewStyle, type ViewProps } from 'react-native'
import { GlassView } from '@/components/ui/GlassView'
import { useTheme } from '@/lib/shared/theme'
import { ELEVATION, RADIUS, type ElevationKey } from '@/lib/ui/tokens'

export type SurfaceVariant = 'glass' | 'glassSm' | 'glassPill' | 'solid'

export interface SurfaceProps extends Omit<ViewProps, 'style'> {
  readonly variant?: SurfaceVariant
  readonly elevation?: ElevationKey
  readonly accent?: string
  readonly glow?: string
  readonly style?: StyleProp<ViewStyle>
  readonly children?: React.ReactNode
}

const GLASS_VARIANT_MAP = {
  glass: 'default',
  glassSm: 'sm',
  glassPill: 'pill',
} as const

const LAYOUT_KEYS = [
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginEnd',
  'marginHorizontal',
  'marginVertical',
  'position',
  'top',
  'bottom',
  'left',
  'right',
  'start',
  'end',
  'zIndex',
  'width',
  'height',
] as const

type LayoutKey = typeof LAYOUT_KEYS[number]

function splitLayoutStyle(style: StyleProp<ViewStyle>): {
  readonly outer: ViewStyle
  readonly inner: ViewStyle
} {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>
  const outer: Record<string, unknown> = {}
  const inner: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(flat)) {
    if ((LAYOUT_KEYS as readonly string[]).includes(key as LayoutKey)) {
      outer[key] = value
    } else {
      inner[key] = value
    }
  }
  return { outer: outer as ViewStyle, inner: inner as ViewStyle }
}

export function Surface({
  variant = 'glass',
  elevation = 'none',
  accent,
  glow,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const theme = useTheme()
  const shadowStyle = ELEVATION[elevation]
  const accentStyle: ViewStyle | undefined = accent
    ? { borderLeftWidth: 3, borderLeftColor: accent }
    : undefined

  if (variant === 'solid') {
    return (
      <View
        style={[
          {
            backgroundColor: theme.surface.background,
            borderWidth: 0.5,
            borderColor: theme.surface.border,
            borderRadius: RADIUS.lg,
            overflow: 'hidden',
          },
          shadowStyle,
          accentStyle,
          style,
        ]}
        {...rest}
      >
        {children}
      </View>
    )
  }

  const { outer: outerLayout, inner: innerVisual } = splitLayoutStyle(style)
  const needsWrapper = elevation !== 'none' || Object.keys(outerLayout).length > 0

  if (!needsWrapper) {
    return (
      <GlassView
        variant={GLASS_VARIANT_MAP[variant]}
        glow={glow}
        style={[accentStyle, innerVisual]}
        {...rest}
      >
        {children}
      </GlassView>
    )
  }

  return (
    <View style={[shadowStyle, outerLayout]} {...rest}>
      <GlassView
        variant={GLASS_VARIANT_MAP[variant]}
        glow={glow}
        style={[accentStyle, innerVisual]}
      >
        {children}
      </GlassView>
    </View>
  )
}
