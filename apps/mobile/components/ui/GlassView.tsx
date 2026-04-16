/**
 * GlassView — Frosted glass surface component using expo-blur.
 *
 * Wraps BlurView with glass styling (background, border, radius).
 * Variants mirror the web app's .glass / .glass-sm / .glass-pill CSS classes.
 * Optional `glow` prop adds an ambient animated gradient on the top edge.
 *
 * Surface colors, border, and blur tint are read from `useTheme()` so the
 * component follows the active theme.
 */

import { useEffect } from 'react'
import { View, type ViewProps, Platform, StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useTheme } from '@/lib/shared/theme'
import type { Theme } from '@/lib/shared/theme'

type GlassVariant = 'default' | 'sm' | 'pill'

interface GlassViewProps extends ViewProps {
  readonly variant?: GlassVariant
  readonly intensity?: number
  /** Optional glow color for ambient top-edge gradient (e.g. '#f59e0b' for amber) */
  readonly glow?: string
}

interface VariantShape {
  readonly borderRadius: number
  readonly intensity: number
  readonly backgroundKey: 'glass' | 'glassSm' | 'glassPill'
  readonly borderKey: 'border' | 'borderPill'
}

const VARIANT_SHAPE: Record<GlassVariant, VariantShape> = {
  default: { borderRadius: 24, intensity: 20, backgroundKey: 'glass', borderKey: 'border' },
  sm: { borderRadius: 12, intensity: 16, backgroundKey: 'glassSm', borderKey: 'border' },
  pill: { borderRadius: 9999, intensity: 16, backgroundKey: 'glassPill', borderKey: 'borderPill' },
}

function resolveVariantColors(theme: Theme, variant: GlassVariant) {
  const shape = VARIANT_SHAPE[variant]
  return {
    borderRadius: shape.borderRadius,
    intensity: shape.intensity,
    backgroundColor: theme.surface[shape.backgroundKey],
    borderColor: theme.surface[shape.borderKey],
  }
}

function AmbientGlow({ color }: { color: string }) {
  const translateX = useSharedValue(-20)

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(20, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    )
  }, [translateX])

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  return (
    <Animated.View style={[styles.glowContainer, glowStyle]}>
      <LinearGradient
        colors={[`${color}15`, 'transparent']}
        style={styles.glowGradient}
      />
    </Animated.View>
  )
}

export function GlassView({
  variant = 'default',
  intensity: intensityOverride,
  glow,
  style,
  children,
  ...props
}: GlassViewProps) {
  const theme = useTheme()
  const config = resolveVariantColors(theme, variant)
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
        {glow && <AmbientGlow color={glow} />}
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
        tint={theme.blurTint}
        style={StyleSheet.absoluteFill}
      />
      {glow && <AmbientGlow color={glow} />}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  glowContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    zIndex: 0,
  },
  glowGradient: {
    width: '100%',
    height: '100%',
  },
})
