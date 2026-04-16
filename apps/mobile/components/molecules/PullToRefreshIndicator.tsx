/**
 * PullToRefreshIndicator — Custom refresh indicator with mini spectrum bar.
 * Fills proportionally to pull distance, shimmers during active refresh.
 */

import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useTheme } from '@/lib/shared/theme'

interface Props {
  /** 0..1 representing pull progress before refresh triggers */
  readonly progress: number
  /** Whether the list is actively refreshing */
  readonly refreshing: boolean
}

const SPECTRUM_COLORS = ['#3b82f6', '#60a5fa', '#9ca3af', '#f87171', '#ef4444']
const BAR_HEIGHT = 4

export function PullToRefreshIndicator({ progress, refreshing }: Props) {
  const theme = useTheme()
  const shimmerTranslate = useSharedValue(-1)

  useEffect(() => {
    if (refreshing) {
      shimmerTranslate.value = -1
      shimmerTranslate.value = withRepeat(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    } else {
      shimmerTranslate.value = -1
    }
  }, [refreshing, shimmerTranslate])

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmerTranslate.value > -1 ? 0.4 + (shimmerTranslate.value + 1) * 0.3 : 1,
  }))

  if (progress <= 0 && !refreshing) return null

  const fillFraction = refreshing ? 1 : Math.min(progress, 1)

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.barWrapper, { backgroundColor: theme.semantic.muted.bg }, shimmerStyle]}>
        <View style={[styles.bar, { width: `${fillFraction * 100}%` }]}>
          <View style={styles.segments}>
            {SPECTRUM_COLORS.map((color, i) => (
              <View
                key={i}
                style={[styles.segment, { backgroundColor: color }]}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  barWrapper: {
    width: 120,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  segments: {
    flexDirection: 'row',
    height: '100%',
  },
  segment: {
    flex: 1,
  },
})
