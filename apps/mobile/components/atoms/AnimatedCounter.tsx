/**
 * AnimatedCounter — Number that counts up from 0 to target value.
 * Uses reanimated + runOnJS to drive React state for display.
 */

import { useEffect, useState } from 'react'
import { Text, type TextStyle } from 'react-native'
import {
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated'
import { useTheme } from '@/lib/shared/theme'

interface Props {
  readonly value: number
  readonly duration?: number
  readonly style?: TextStyle
  readonly suffix?: string
  readonly prefix?: string
}

export function AnimatedCounter({ value, duration = 800, style, suffix = '', prefix = '' }: Props) {
  const theme = useTheme()
  const animatedValue = useSharedValue(0)
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    })
  }, [value, duration, animatedValue])

  useAnimatedReaction(
    () => Math.round(animatedValue.value),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setDisplayValue)(current)
      }
    },
    []
  )

  return (
    <Text style={[{ fontFamily: 'Inter-SemiBold', fontSize: 24, color: theme.text.primary }, style]}>
      {prefix}{displayValue}{suffix}
    </Text>
  )
}
