import { View, Text } from 'react-native'
import type { BiasCategory } from '@/lib/shared/types'
import { BIAS_LABELS, BIAS_OPACITY } from '@/lib/shared/types'
import { useTheme } from '@/lib/shared/theme'

interface BiasTagProps {
  readonly bias: BiasCategory
  readonly compact?: boolean
}

export function BiasTag({ bias, compact = false }: BiasTagProps) {
  const theme = useTheme()
  const opacity = BIAS_OPACITY[bias]
  // High-opacity tints are dense enough to read text against; show strong
  // contrast text. Low-opacity tints fade into the surface; use secondary text.
  const labelColor = opacity > 0.4 ? theme.surface.background : theme.text.secondary
  return (
    <View
      accessibilityLabel={`${BIAS_LABELS[bias]} bias`}
      style={{
        backgroundColor: `rgba(${theme.inkRgb}, ${opacity})`,
        borderRadius: 9999,
        paddingHorizontal: compact ? 8 : 12,
        paddingVertical: compact ? 2 : 4,
      }}
    >
      <Text
        style={{
          fontFamily: 'Inter',
          fontSize: compact ? 10 : 12,
          color: labelColor,
        }}
      >
        {BIAS_LABELS[bias]}
      </Text>
    </View>
  )
}
