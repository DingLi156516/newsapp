import { useState } from 'react'
import { type ViewProps, type LayoutChangeEvent } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  useAnimatedReaction,
  Easing,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'

interface SkeletonProps extends ViewProps {
  readonly width?: number | string
  readonly height?: number
  readonly borderRadius?: number
  /** Stagger delay in ms for cascading shimmer effect */
  readonly delay?: number
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, delay = 0, style, ...props }: SkeletonProps) {
  const [measuredWidth, setMeasuredWidth] = useState(0)
  const translateX = useSharedValue(-measuredWidth || -200)

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w > 0) setMeasuredWidth(w)
  }

  useAnimatedReaction(
    () => measuredWidth,
    (w) => {
      if (w > 0) {
        translateX.value = -w
        translateX.value = withDelay(
          delay,
          withRepeat(
            withTiming(w, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            -1,
            false
          )
        )
      }
    },
    [measuredWidth, delay]
  )

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[
        {
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          width: width as number,
          height,
          borderRadius,
          overflow: 'hidden',
        },
        style,
      ]}
      {...props}
    >
      <Animated.View style={[{ width: '100%', height: '100%' }, shimmerStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.08)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: '100%', height: '100%' }}
        />
      </Animated.View>
    </Animated.View>
  )
}
