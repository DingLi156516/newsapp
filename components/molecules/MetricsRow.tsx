/**
 * components/molecules/MetricsRow.tsx — Compact trending metrics.
 *
 * Surfaces three existing story signals inline on a card:
 *   - impact_score     (0-100 composite)
 *   - articles_24h     (velocity)
 *   - source_diversity (unique ownership count)
 *
 * Rendered conditionally by NexusCard when the feed is sorted by trending,
 * so unused metrics never clutter the Latest / Saved / Blindspot views.
 * Returns `null` when every metric is absent.
 */

import { TrendingUp, Zap, Layers } from 'lucide-react'

interface Props {
  readonly impactScore?: number | null
  readonly articles24h?: number | null
  readonly sourceDiversity?: number | null
}

export function MetricsRow({ impactScore, articles24h, sourceDiversity }: Props) {
  const hasImpact = typeof impactScore === 'number'
  const hasVelocity = typeof articles24h === 'number'
  const hasDiversity = typeof sourceDiversity === 'number'

  if (!hasImpact && !hasVelocity && !hasDiversity) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-white/60">
      {hasImpact && (
        <span
          data-testid="metrics-impact"
          aria-label={`Impact score ${clamp100(impactScore!)} of 100`}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5"
        >
          <TrendingUp size={10} className="text-white/50" aria-hidden />
          <span className="font-semibold tabular-nums text-white/80">{clamp100(impactScore!)}</span>
          <span className="text-white/40">impact</span>
        </span>
      )}
      {hasVelocity && (
        <span
          data-testid="metrics-velocity"
          aria-label={`${articles24h} articles in last 24 hours`}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5"
        >
          <Zap size={10} className="text-white/50" aria-hidden />
          <span className="font-semibold tabular-nums text-white/80">{articles24h}</span>
          <span className="text-white/40">/24h</span>
        </span>
      )}
      {hasDiversity && (
        <span
          data-testid="metrics-diversity"
          aria-label={`${sourceDiversity} distinct ownership groups`}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5"
        >
          <Layers size={10} className="text-white/50" aria-hidden />
          <span className="font-semibold tabular-nums text-white/80">{sourceDiversity}</span>
          <span className="text-white/40">owners</span>
        </span>
      )}
    </div>
  )
}

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
