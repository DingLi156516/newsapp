/**
 * components/organisms/BiasDriftChart.tsx — Per-story bias drift over time.
 *
 * Vertically stacked stacked-spectrum bars, one per timeline event, showing
 * how the cumulative L/C/R distribution of a story's coverage evolved as new
 * sources published.
 *
 * Source: `cumulativeSpectrum` from `lib/api/timeline-transformer.ts`.
 * No new endpoint — this reuses the existing story timeline payload.
 */
'use client'

import { motion } from 'framer-motion'
import type { TimelineEvent, SpectrumSegment } from '@/lib/types'
import { BIAS_CSS_CLASS } from '@/lib/types'

interface Props {
  readonly events: readonly TimelineEvent[]
  /**
   * Story's current total source count. `transformTimeline()` caps its event
   * list at 20 entries, so for large stories the last drift bar is not the
   * live state. When provided and higher than the last dedupped event's
   * cumulative count, the chart renders a footer noting that N more sources
   * have joined since — without fabricating a spectrum bar, because
   * `article.spectrumSegments` is computed per-article while drift events
   * are computed per-unique-source and the two are not comparable.
   */
  readonly currentSourceCount?: number
}

const MIN_EVENTS_FOR_DRIFT = 3

function formatRelative(fromMs: number, toMs: number): string {
  const diffMs = Math.max(0, toMs - fromMs)
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 24) return `+${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  return `+${diffDays}d`
}

/**
 * `transformTimeline()` can emit up to three events for a single publication
 * (source-added + spectrum-shift + milestone) that all share the same
 * timestamp, cumulative source count, and spectrum. Collapse duplicates so
 * the drift chart shows one bar per coverage update.
 */
function dedupeEvents(events: readonly TimelineEvent[]): readonly TimelineEvent[] {
  const seen = new Set<string>()
  const result: TimelineEvent[] = []
  for (const event of events) {
    const key = `${event.timestamp}|${event.cumulativeSourceCount}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(event)
  }
  return result
}

function StackedBar({
  segments,
  index,
}: {
  segments: readonly SpectrumSegment[]
  index: number
}) {
  const active = segments.filter((s) => s.percentage > 0)
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-white/5"
      role="img"
      aria-label="Cumulative source bias distribution at this point"
    >
      {active.map((segment) => (
        <motion.div
          key={segment.bias}
          className={BIAS_CSS_CLASS[segment.bias]}
          initial={{ width: 0 }}
          animate={{ width: `${segment.percentage}%` }}
          transition={{ duration: 0.5, delay: index * 0.05, ease: 'easeOut' }}
          title={`${segment.bias}: ${segment.percentage}%`}
        />
      ))}
    </div>
  )
}

export function BiasDriftChart({ events, currentSourceCount }: Props) {
  const drift = dedupeEvents(events)
  if (drift.length < MIN_EVENTS_FOR_DRIFT) return null

  const baseMs = new Date(drift[0].timestamp).getTime()
  const lastCount = drift[drift.length - 1].cumulativeSourceCount
  const additionalSources =
    currentSourceCount !== undefined && currentSourceCount > lastCount
      ? currentSourceCount - lastCount
      : 0

  return (
    <section
      className="glass p-5 space-y-4"
      aria-label="Story bias drift over time"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold tracking-widest uppercase text-white/60">
          How Coverage Shifted
        </h3>
        <p className="text-[10px] text-white/40">
          Cumulative source bias at each update
        </p>
      </div>

      <ul className="space-y-2.5">
        {drift.map((event, index) => {
          const elapsed = formatRelative(baseMs, new Date(event.timestamp).getTime())
          return (
            <li
              key={event.id}
              className="flex items-center gap-3"
              data-testid="bias-drift-row"
            >
              <span className="w-10 flex-shrink-0 text-[10px] tabular-nums text-white/50">
                {elapsed}
              </span>
              <div className="flex-1">
                <StackedBar segments={event.cumulativeSpectrum} index={index} />
              </div>
              <span className="w-10 flex-shrink-0 text-[10px] tabular-nums text-white/40 text-right">
                {event.cumulativeSourceCount} src
              </span>
            </li>
          )
        })}
      </ul>

      {additionalSources > 0 && (
        <p
          className="text-[10px] text-white/40 pt-1"
          data-testid="bias-drift-truncation-note"
        >
          + {additionalSources} more source{additionalSources === 1 ? '' : 's'} joined
          since (drift limited to the first {drift.length} updates)
        </p>
      )}
    </section>
  )
}
