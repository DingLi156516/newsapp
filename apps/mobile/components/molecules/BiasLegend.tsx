import { View, Text } from 'react-native'
import { ALL_BIASES, BIAS_LABELS, BIAS_OPACITY } from '@/lib/shared/types'
import { useTheme } from '@/lib/shared/theme'

export function BiasLegend() {
  const theme = useTheme()
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 8 }}>
      {ALL_BIASES.map((bias) => (
        <View key={bias} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: `rgba(${theme.inkRgb}, ${BIAS_OPACITY[bias]})`,
              borderWidth: 0.5,
              borderColor: theme.surface.border,
            }}
          />
          <Text style={{ fontFamily: 'Inter', fontSize: 10, color: theme.text.secondary }}>
            {BIAS_LABELS[bias]}
          </Text>
        </View>
      ))}
    </View>
  )
}
