/**
 * StoryScores — Three animated score gauges in a collapsible section.
 * Shows impact, source diversity, and controversy scores.
 */

import { View } from 'react-native'
import { CollapsibleSection } from '@/components/molecules/CollapsibleSection'
import { ScoreGauge } from '@/components/atoms/ScoreGauge'
import { SPACING } from '@/lib/shared/design'

interface Props {
  readonly impactScore: number | null | undefined
  readonly sourceDiversity: number | null | undefined
  readonly controversyScore: number | null | undefined
}

export function StoryScores({ impactScore, sourceDiversity, controversyScore }: Props) {
  if (impactScore == null && sourceDiversity == null && controversyScore == null) {
    return null
  }

  return (
    <CollapsibleSection title="Story Scores">
      <View style={{ padding: SPACING.lg, gap: SPACING.md }}>
        {impactScore != null && (
          <ScoreGauge label="Impact" value={impactScore} color="#8B5CF6" />
        )}
        {sourceDiversity != null && (
          <ScoreGauge label="Source Diversity" value={sourceDiversity} color="#3B82F6" />
        )}
        {controversyScore != null && (
          <ScoreGauge label="Controversy" value={controversyScore} color="#EF4444" />
        )}
      </View>
    </CollapsibleSection>
  )
}
