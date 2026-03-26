import { View, Text } from 'react-native'
import { SEMANTIC, BADGE, FONT } from '@/lib/shared/design'

interface CoverageCountProps {
  readonly count: number
}

export function CoverageCount({ count }: CoverageCountProps) {
  const isSingle = count === 1
  const label = isSingle ? 'Single Source' : `${count} sources`

  return (
    <View
      accessibilityLabel={label}
      style={{
        backgroundColor: isSingle ? SEMANTIC.warning.bg : 'rgba(255, 255, 255, 0.1)',
        borderRadius: BADGE.borderRadius,
        borderWidth: isSingle ? 0.5 : 0,
        borderColor: isSingle ? SEMANTIC.warning.border : 'transparent',
        paddingHorizontal: BADGE.paddingH,
        paddingVertical: BADGE.paddingV,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <Text style={{
        fontFamily: FONT.small.family,
        fontSize: FONT.small.size,
        color: isSingle ? SEMANTIC.warning.color : 'rgba(255, 255, 255, 0.7)',
      }}>
        {label}
      </Text>
    </View>
  )
}
