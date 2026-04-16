import { View, Text } from 'react-native'
import { BADGE } from '@/lib/shared/design'
import { useTheme } from '@/lib/shared/theme'

export function BlindspotBadge() {
  const theme = useTheme()
  const warn = theme.semantic.warning
  return (
    <View accessibilityLabel="Blindspot story" style={{
      backgroundColor: warn.bg,
      borderWidth: 0.5,
      borderColor: warn.border,
      borderRadius: BADGE.borderRadius,
      paddingHorizontal: BADGE.paddingH,
      paddingVertical: BADGE.paddingV,
    }}>
      <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 10, color: warn.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Blindspot
      </Text>
    </View>
  )
}
