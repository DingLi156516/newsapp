import { useEffect } from 'react'
import { type ViewProps } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated'

interface SkeletonProps extends ViewProps {
  readonly width?: number | string
  readonly height?: number
  readonly borderRadius?: number
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style, ...props }: SkeletonProps) {
  const opacity = useSharedValue(0.15)

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.3, { duration: 1000 }),
      -1,
      true
    )
  }, [opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    backgroundColor: 'rgba(255, 255, 255, 1)',
    width: width as number,
    height,
    borderRadius,
  }))

  return <Animated.View style={[animatedStyle, style]} {...props} />
}
