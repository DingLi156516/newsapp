/**
 * ScoreGauge — Animated horizontal progress bar for numeric scores.
 * Uses reanimated for smooth fill animation on mount.
 */

import { View, Text } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useEffect } from 'react'
import { ANIMATION, BORDER_RADIUS } from '@/lib/shared/design'

interface Props {
  readonly label: string
  readonly value: number
  readonly max?: number
  readonly color?: string
}

export function ScoreGauge({ label, value, max = 100, color = '#3B82F6' }: Props) {
  const fillWidth = useSharedValue(0)
  const percentage = Math.min(Math.max(value / max, 0), 1) * 100

  useEffect(() => {
    fillWidth.value = withSpring(percentage, ANIMATION.springStiff)
  }, [percentage, fillWidth])

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillWidth.value}%`,
  }))

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>
          {label}
        </Text>
        <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 12, color: 'rgba(255, 255, 255, 0.8)' }}>
          {Math.round(value)}
        </Text>
      </View>
      <View style={{
        height: 6,
        borderRadius: BORDER_RADIUS.xs,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
      }}>
        <Animated.View
          style={[
            { height: '100%', borderRadius: BORDER_RADIUS.xs, backgroundColor: color },
            fillStyle,
          ]}
        />
      </View>
    </View>
  )
}
