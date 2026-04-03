/**
 * HeadlineComparisonList — Collapsible list showing how different outlets titled the story.
 * Headlines sorted by political bias (left to right).
 */

import { View, Text } from 'react-native'
import { CollapsibleSection } from '@/components/molecules/CollapsibleSection'
import { SPACING } from '@/lib/shared/design'
import type { HeadlineComparison, BiasCategory } from '@/lib/shared/types'
import { BIAS_LABELS, BIAS_COLOR } from '@/lib/shared/types'

interface Props {
  readonly headlines: readonly HeadlineComparison[]
}

const BIAS_ORDER: Record<string, number> = {
  'far-left': 0, 'left': 1, 'lean-left': 2, 'center': 3,
  'lean-right': 4, 'right': 5, 'far-right': 6,
}

export function HeadlineComparisonList({ headlines }: Props) {
  if (headlines.length === 0) return null

  const sorted = [...headlines].sort(
    (a, b) => (BIAS_ORDER[a.sourceBias] ?? 3) - (BIAS_ORDER[b.sourceBias] ?? 3)
  )

  return (
    <CollapsibleSection
      title="How They Headlined It"
      subtitle={`${headlines.length} outlet${headlines.length === 1 ? '' : 's'}`}
    >
      {/* Semantic prefix + index: HeadlineComparison has no id field and this list
         is static API data that never reorders, so index keys are safe. */}
      {sorted.map((headline, i) => {
        const color = BIAS_COLOR[headline.sourceBias as BiasCategory] ?? '#A1A1AA'
        return (
          <View
            key={`${headline.sourceName}-${i}`}
            style={{
              paddingHorizontal: SPACING.lg,
              paddingVertical: SPACING.md,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: SPACING.md,
              borderBottomWidth: i < sorted.length - 1 ? 0.5 : 0,
              borderBottomColor: 'rgba(255, 255, 255, 0.04)',
            }}
          >
            <View style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: color,
              marginTop: 4,
            }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Inter', fontSize: 13, lineHeight: 19, color: 'rgba(255, 255, 255, 0.85)' }}>
                {headline.title}
              </Text>
              <Text style={{ fontFamily: 'Inter', fontSize: 11, color: 'rgba(255, 255, 255, 0.45)', marginTop: 3 }}>
                {headline.sourceName}
                <Text style={{ color: 'rgba(255, 255, 255, 0.2)' }}> {'\u00B7'} </Text>
                {BIAS_LABELS[headline.sourceBias as BiasCategory] ?? headline.sourceBias}
              </Text>
            </View>
          </View>
        )
      })}
    </CollapsibleSection>
  )
}
