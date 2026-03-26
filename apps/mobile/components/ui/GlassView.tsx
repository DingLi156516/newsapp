/**
 * GlassView — Frosted glass surface component using expo-blur.
 *
 * Wraps BlurView with glass styling (background, border, radius).
 * Variants mirror the web app's .glass / .glass-sm / .glass-pill CSS classes.
 */

import { View, type ViewProps, Platform, StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'

type GlassVariant = 'default' | 'sm' | 'pill'

interface GlassViewProps extends ViewProps {
  readonly variant?: GlassVariant
  readonly intensity?: number
}

const VARIANT_CONFIG: Record<GlassVariant, {
  borderRadius: number
  backgroundColor: string
  borderColor: string
  intensity: number
}> = {
  default: {
    borderRadius: 24,
    backgroundColor: 'rgba(26, 26, 26, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    intensity: 20,
  },
  sm: {
    borderRadius: 12,
    backgroundColor: 'rgba(26, 26, 26, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    intensity: 16,
  },
  pill: {
    borderRadius: 9999,
    backgroundColor: 'rgba(26, 26, 26, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    intensity: 16,
  },
}

export function GlassView({
  variant = 'default',
  intensity: intensityOverride,
  style,
  children,
  ...props
}: GlassViewProps) {
  const config = VARIANT_CONFIG[variant]
  const blurIntensity = intensityOverride ?? config.intensity

  // Android BlurView can be unreliable — fall back to semi-transparent bg
  if (Platform.OS === 'android') {
    return (
      <View
        style={[
          {
            borderRadius: config.borderRadius,
            backgroundColor: config.backgroundColor,
            borderWidth: 0.5,
            borderColor: config.borderColor,
            overflow: 'hidden',
          },
          style,
        ]}
        {...props}
      >
        {children}
      </View>
    )
  }

  return (
    <View
      style={[
        {
          borderRadius: config.borderRadius,
          borderWidth: 0.5,
          borderColor: config.borderColor,
          backgroundColor: config.backgroundColor,
          overflow: 'hidden',
        },
        style,
      ]}
      {...props}
    >
      <BlurView
        intensity={blurIntensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  )
}
