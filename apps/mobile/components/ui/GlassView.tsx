/**
 * GlassView — Frosted glass surface component using expo-blur.
 *
 * Wraps BlurView with glass styling (background, border, radius).
 * Variants mirror the web app's .glass / .glass-sm / .glass-pill CSS classes.
 * Optional `glow` prop adds an ambient animated gradient on the top edge.
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

type GlassVariant = 'default' | 'sm' | 'pill'

interface GlassViewProps extends ViewProps {
  readonly variant?: GlassVariant
  readonly intensity?: number
  /** Optional glow color for ambient top-edge gradient (e.g. '#f59e0b' for amber) */
  readonly glow?: string
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
        tint="dark"
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
