/**
 * BiasDonutChart — SVG donut chart showing bias distribution.
 * Segments animate in with strokeDashoffset.
 */

import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { BIAS_LABELS } from '@/lib/shared/types'
import type { BiasCategory } from '@/lib/shared/types'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface BiasSegment {
  readonly bias: BiasCategory
  readonly percentage: number
}

interface Props {
  readonly distribution: readonly BiasSegment[]
  readonly size?: number
  readonly strokeWidth?: number
}

const SEGMENT_COLORS: Record<BiasCategory, string> = {
  'far-left': '#2563eb',
  'left': '#3b82f6',
  'lean-left': '#60a5fa',
  'center': '#9ca3af',
  'lean-right': '#f87171',
  'right': '#ef4444',
  'far-right': '#dc2626',
}

function DonutSegment({
  bias,
  percentage,
  offset,
  radius,
  circumference,
  strokeWidth,
  cx,
  cy,
}: {
  bias: BiasCategory
  percentage: number
  offset: number
  radius: number
  circumference: number
  strokeWidth: number
  cx: number
  cy: number
}) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })
  }, [progress])

  const segmentLength = (percentage / 100) * circumference
  const dashArray = `${segmentLength} ${circumference - segmentLength}`

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value) + offset,
  }))

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={radius}
      stroke={SEGMENT_COLORS[bias]}
      strokeWidth={strokeWidth}
      fill="transparent"
      strokeDasharray={dashArray}
      strokeLinecap="round"
      rotation={-90}
      origin={`${cx}, ${cy}`}
      animatedProps={animatedProps}
    />
  )
}

export function BiasDonutChart({ distribution, size = 160, strokeWidth = 14 }: Props) {
  const cx = size / 2
  const cy = size / 2
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  const segments = distribution.filter(s => s.percentage > 0)
  let cumulativeOffset = 0

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        {/* Background ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Data segments */}
        {segments.map((segment) => {
          const offset = -(cumulativeOffset / 100) * circumference
          cumulativeOffset += segment.percentage
          return (
            <DonutSegment
              key={segment.bias}
              bias={segment.bias}
              percentage={segment.percentage}
              offset={offset}
              radius={radius}
              circumference={circumference}
              strokeWidth={strokeWidth}
              cx={cx}
              cy={cy}
            />
          )
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        {segments.map((s) => (
          <View key={s.bias} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: SEGMENT_COLORS[s.bias] }]} />
            <Text style={styles.legendLabel}>{BIAS_LABELS[s.bias]}</Text>
            <Text style={styles.legendValue}>{s.percentage}%</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  legendValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
  },
})
