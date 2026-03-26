import { View, Text } from 'react-native'
import type { BiasCategory } from '@/lib/shared/types'
import { BIAS_LABELS, BIAS_OPACITY } from '@/lib/shared/types'

interface BiasTagProps {
  readonly bias: BiasCategory
  readonly compact?: boolean
}

export function BiasTag({ bias, compact = false }: BiasTagProps) {
  return (
    <View
      accessibilityLabel={`${BIAS_LABELS[bias]} bias`}
      style={{
        backgroundColor: `rgba(255, 255, 255, ${BIAS_OPACITY[bias]})`,
        borderRadius: 9999,
        paddingHorizontal: compact ? 8 : 12,
        paddingVertical: compact ? 2 : 4,
      }}
    >
      <Text
        style={{
          fontFamily: 'Inter',
          fontSize: compact ? 10 : 12,
          color: BIAS_OPACITY[bias] > 0.4 ? '#0A0A0A' : 'rgba(255, 255, 255, 0.8)',
        }}
      >
        {BIAS_LABELS[bias]}
      </Text>
    </View>
  )
}
