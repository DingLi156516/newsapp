/**
 * BiasDistributionList — 7-bar breakdown of the user's bias distribution
 * against the overall distribution. Blindspot biases render in the warning
 * tone. Extracted from Profile's "Detailed Breakdown" block so the web app
 * can consume the same shape in a later shared-types pass.
 */

import { View, Text } from 'react-native'
import { BIAS_LABELS, BIAS_OPACITY, type BiasCategory } from '@/lib/shared/types'
import { useTheme } from '@/lib/shared/theme'
import { SPACING } from '@/lib/ui/tokens'

export interface BiasDistributionItem {
  readonly bias: BiasCategory
  readonly percentage: number
}

export interface BiasDistributionListProps {
  readonly userDistribution: readonly BiasDistributionItem[]
  readonly overallDistribution: readonly BiasDistributionItem[]
  readonly blindspots: readonly BiasCategory[]
}

export function BiasDistributionList({
  userDistribution,
  overallDistribution,
  blindspots,
}: BiasDistributionListProps) {
  const theme = useTheme()
  const warn = theme.semantic.warning
  const blindspotSet = new Set(blindspots)

  return (
    <View style={{ gap: SPACING.md }}>
      {userDistribution.map((item) => {
        const overall = overallDistribution.find((o) => o.bias === item.bias)
        const isBlindspot = blindspotSet.has(item.bias)

        return (
          <View key={item.bias} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{
                fontFamily: 'Inter',
                fontSize: 12,
                color: isBlindspot ? warn.color : theme.text.secondary,
              }}>
                {BIAS_LABELS[item.bias]}
                {isBlindspot ? ' (blindspot)' : ''}
              </Text>
              <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.text.tertiary }}>
                {item.percentage}% / {overall?.percentage ?? 0}%
              </Text>
            </View>
            <View style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: `rgba(${theme.inkRgb}, 0.05)`,
              position: 'relative',
              overflow: 'hidden',
            }}>
              <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: 8,
                borderRadius: 4,
                width: `${overall?.percentage ?? 0}%`,
                backgroundColor: `rgba(${theme.inkRgb}, 0.1)`,
              }} />
              <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: 8,
                borderRadius: 4,
                width: `${item.percentage}%`,
                backgroundColor: `rgba(${theme.inkRgb}, ${BIAS_OPACITY[item.bias]})`,
              }} />
            </View>
          </View>
        )
      })}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: `rgba(${theme.inkRgb}, 0.3)` }} />
          <Text style={{ fontFamily: 'Inter', fontSize: 10, color: theme.text.tertiary }}>Your reading</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: `rgba(${theme.inkRgb}, 0.1)` }} />
          <Text style={{ fontFamily: 'Inter', fontSize: 10, color: theme.text.tertiary }}>All stories</Text>
        </View>
      </View>
    </View>
  )
}
