import { View, Text } from 'react-native'
import { BADGE, FONT } from '@/lib/shared/design'
import { useTheme } from '@/lib/shared/theme'

interface CoverageCountProps {
  readonly count: number
}

export function CoverageCount({ count }: CoverageCountProps) {
  const theme = useTheme()
  const isSingle = count === 1
  const label = isSingle ? 'Single Source' : `${count} sources`
  const warn = theme.semantic.warning

  return (
    <View
      accessibilityLabel={label}
      style={{
        backgroundColor: isSingle ? warn.bg : theme.surface.glassPill,
        borderRadius: BADGE.borderRadius,
        borderWidth: isSingle ? 0.5 : 0,
        borderColor: isSingle ? warn.border : 'transparent',
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
        color: isSingle ? warn.color : theme.text.secondary,
      }}>
        {label}
      </Text>
    </View>
  )
}
