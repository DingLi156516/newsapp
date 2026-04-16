/**
 * ScrollProgressBar — Thin gradient bar at top showing read progress.
 * Uses spectrum colors (blue -> gray -> red) to match the app's bias theme.
 * Animates scaleX (transform-only) for optimal scroll-path performance.
 */

import { StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { type SharedValue, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated'

interface Props {
  /** Animated scroll Y position */
  readonly scrollY: SharedValue<number>
  /** Total scrollable content height */
  readonly contentHeight: number
  /** Visible viewport height */
  readonly viewportHeight: number
}

export function ScrollProgressBar({ scrollY, contentHeight, viewportHeight }: Props) {
  const maxScroll = contentHeight - viewportHeight

  const scaleStyle = useAnimatedStyle(() => {
    if (maxScroll <= 0) return { transform: [{ scaleX: 0 }] }
    const progress = interpolate(scrollY.value, [0, maxScroll], [0, 1], Extrapolation.CLAMP)
    return { transform: [{ scaleX: progress }] }
  })

  if (maxScroll <= 0) return null

  return (
    <Animated.View style={[styles.container, scaleStyle]}>
      <LinearGradient
        colors={['#3b82f6', '#9ca3af', '#ef4444']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    zIndex: 200,
    transformOrigin: 'left',
  },
})
