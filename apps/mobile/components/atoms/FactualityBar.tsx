import { View, Text } from 'react-native'
import type { FactualityLevel } from '@/lib/shared/types'
import { FACTUALITY_LABELS } from '@/lib/shared/types'
import { FACTUALITY } from '@/lib/shared/design'

interface FactualityBarProps {
  readonly level: FactualityLevel
  readonly size?: 'default' | 'compact'
  readonly showLabel?: boolean
}

const SIZES = {
  default: { width: 40, height: 4 },
  compact: { width: 28, height: 3 },
} as const

export function FactualityBar({ level, size = 'default', showLabel = false }: FactualityBarProps) {
  const token = FACTUALITY[level]
  const { width, height } = SIZES[size]
  const borderRadius = height / 2

  return (
    <View
      accessibilityLabel={`Factuality: ${FACTUALITY_LABELS[level]}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      <View
        style={{
          width,
          height,
          borderRadius,
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${token.fill * 100}%`,
            height: '100%',
            borderRadius,
            backgroundColor: token.color,
          }}
        />
      </View>
      {showLabel && (
        <Text style={{ fontFamily: 'Inter', fontSize: 10, color: token.color }}>
          {FACTUALITY_LABELS[level]}
        </Text>
      )}
    </View>
  )
}
