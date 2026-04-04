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
  readonly sourceCount?: number
}

export function StoryScores({ impactScore, sourceDiversity, controversyScore, sourceCount }: Props) {
  const isSingleSource = sourceCount === 1
  const hasImpact = impactScore != null
  const hasDiversity = !isSingleSource && sourceDiversity != null
  const hasControversy = !isSingleSource && controversyScore != null

  if (!hasImpact && !hasDiversity && !hasControversy) {
    return null
  }

  return (
    <CollapsibleSection title="Story Scores">
      <View style={{ padding: SPACING.lg, gap: SPACING.md }}>
        {hasImpact && (
          <ScoreGauge label="Impact" value={impactScore} max={100} color="#8B5CF6" />
        )}
        {hasDiversity && (
          <ScoreGauge label="Source Diversity" value={sourceDiversity} max={8} color="#3B82F6" />
        )}
        {hasControversy && (
          <ScoreGauge label="Controversy" value={controversyScore} max={1} color="#EF4444" />
        )}
      </View>
    </CollapsibleSection>
  )
}
