import { View, Text } from 'react-native'
import { SEMANTIC, BADGE } from '@/lib/shared/design'

export function BlindspotBadge() {
  return (
    <View accessibilityLabel="Blindspot story" style={{
      backgroundColor: SEMANTIC.warning.bg,
      borderWidth: 0.5,
      borderColor: SEMANTIC.warning.border,
      borderRadius: BADGE.borderRadius,
      paddingHorizontal: BADGE.paddingH,
      paddingVertical: BADGE.paddingV,
    }}>
      <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 10, color: SEMANTIC.warning.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Blindspot
      </Text>
    </View>
  )
}
