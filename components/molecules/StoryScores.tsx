/**
 * components/molecules/StoryScores.tsx — Glass card with animated score bars.
 */
'use client'

import { ScoreBar } from '@/components/atoms/ScoreBar'

interface Props {
  readonly impactScore?: number | null
  readonly sourceDiversity?: number | null
  readonly controversyScore?: number | null
  readonly sourceCount?: number
}

export function StoryScores({ impactScore, sourceDiversity, controversyScore, sourceCount }: Props) {
  const isSingleSource = sourceCount === 1
  const hasImpact = impactScore != null
  const hasDiversity = !isSingleSource && sourceDiversity != null
  const hasControversy = !isSingleSource && controversyScore != null

  if (!hasImpact && !hasDiversity && !hasControversy) return null

  return (
    <div className="space-y-2">
      <p className="text-xs text-white/60 uppercase tracking-widest">
        Story Scores
      </p>
      <div className="glass p-5 space-y-4">
        {hasImpact && (
          <ScoreBar label="Impact" value={impactScore} color="#8B5CF6" />
        )}
        {hasDiversity && (
          <ScoreBar label="Source Diversity" value={sourceDiversity} max={8} color="#3B82F6" />
        )}
        {hasControversy && (
          <ScoreBar label="Controversy" value={controversyScore} max={1} color="#EF4444" />
        )}
      </div>
    </div>
  )
}
