'use client'

import type { NewsArticle, StoryTimeline } from '@/lib/types'
import { buildStoryIntelligence } from '@/lib/story-intelligence'

interface Props {
  readonly article: NewsArticle
  readonly timeline: StoryTimeline | null
}

export function CoverageIntelligence({ article, timeline }: Props) {
  const intelligence = buildStoryIntelligence(article, timeline)

  return (
    <section className="space-y-2" aria-labelledby="coverage-intelligence-heading">
      <p
        id="coverage-intelligence-heading"
        className="text-xs text-white/60 uppercase tracking-widest"
      >
        Coverage Intelligence
      </p>

      <div className="glass p-4 space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-white">Coverage shape</p>
          <p className="text-sm text-white/75 leading-relaxed">{intelligence.overview}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="glass-sm p-3 space-y-1">
            <p className="text-xs uppercase tracking-widest text-white/45">Coverage momentum</p>
            <p className="text-sm text-white/75 leading-relaxed">{intelligence.momentumSummary}</p>
          </div>

          <div className="glass-sm p-3 space-y-1">
            <p className="text-xs uppercase tracking-widest text-white/45">Coverage gaps</p>
            <p className="text-sm text-white/75 leading-relaxed">{intelligence.coverageGapSummary}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="glass-sm p-3 space-y-1">
            <p className="text-xs uppercase tracking-widest text-white/45">Framing delta</p>
            <p className="text-sm text-white/75 leading-relaxed">{intelligence.framingDeltaSummary}</p>
          </div>

          <div className="glass-sm p-3 space-y-1">
            <p className="text-xs uppercase tracking-widest text-white/45">How this story was assembled</p>
            <p className="text-sm text-white/75 leading-relaxed">{intelligence.methodologySummary}</p>
            <p className="text-sm text-white/60 leading-relaxed">{intelligence.ownershipSummary}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
