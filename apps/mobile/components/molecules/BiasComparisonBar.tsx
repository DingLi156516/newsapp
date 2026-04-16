/**
 * BiasComparisonBar — Side-by-side spectrum bars comparing user vs overall reading.
 * Adapted from web components/molecules/BiasComparisonBar.tsx.
 */

import { View, Text } from 'react-native'
import { GlassView } from '@/components/ui/GlassView'
import { BIAS_COLOR } from '@/lib/shared/types'
import type { BiasCategory } from '@/lib/shared/types'
import { useTheme } from '@/lib/shared/theme'

interface BiasDistribution {
  readonly bias: BiasCategory
  readonly percentage: number
}

function SingleBar({ label, distribution }: {
  readonly label: string
  readonly distribution: readonly BiasDistribution[]
}) {
  const theme = useTheme()
  const active = distribution.filter((d) => d.percentage > 0)

  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontFamily: 'Inter', fontSize: 11, color: theme.text.tertiary }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: `rgba(${theme.inkRgb}, 0.04)` }}>
        {active.map((segment) => (
          <View
            key={segment.bias}
            style={{
              width: `${segment.percentage}%`,
              backgroundColor: BIAS_COLOR[segment.bias],
              opacity: 0.85,
            }}
          />
        ))}
      </View>
    </View>
  )
}

interface Props {
  readonly userDistribution: readonly BiasDistribution[]
  readonly overallDistribution: readonly BiasDistribution[]
}

export function BiasComparisonBar({ userDistribution, overallDistribution }: Props) {
  const theme = useTheme()
  return (
    <GlassView testID="comparison-bar" style={{ padding: 16, gap: 12 }}>
      <SingleBar label="Your Reading" distribution={userDistribution} />
      <SingleBar label="All Stories" distribution={overallDistribution} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 }}>
        <Text style={{ fontFamily: 'Inter', fontSize: 10, color: theme.text.muted }}>Far Left</Text>
        <Text style={{ fontFamily: 'Inter', fontSize: 10, color: theme.text.muted }}>Center</Text>
        <Text style={{ fontFamily: 'Inter', fontSize: 10, color: theme.text.muted }}>Far Right</Text>
      </View>
    </GlassView>
  )
}
