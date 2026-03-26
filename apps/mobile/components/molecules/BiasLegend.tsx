import { View, Text } from 'react-native'
import { ALL_BIASES, BIAS_LABELS, BIAS_OPACITY } from '@/lib/shared/types'

export function BiasLegend() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 8 }}>
      {ALL_BIASES.map((bias) => (
        <View key={bias} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: `rgba(255, 255, 255, ${BIAS_OPACITY[bias]})`,
              borderWidth: 0.5,
              borderColor: 'rgba(255, 255, 255, 0.15)',
            }}
          />
          <Text style={{ fontFamily: 'Inter', fontSize: 10, color: 'rgba(255, 255, 255, 0.6)' }}>
            {BIAS_LABELS[bias]}
          </Text>
        </View>
      ))}
    </View>
  )
}
