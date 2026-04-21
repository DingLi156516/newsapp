/**
 * components/organisms/HeadlineRoundup.tsx — AllSides-style L/C/R headline roundup.
 *
 * Picks one representative headline per side and renders them in a 3-column
 * grid (stacked on mobile). Empty columns are omitted. Returns null when fewer
 * than two sides have a usable headline.
 */
'use client'

import type { HeadlineComparison } from '@/lib/types'
import { BIAS_CSS_CLASS, BIAS_LABELS } from '@/lib/types'
import { selectHeadlineRoundup, type HeadlineRoundupResult } from '@/lib/utils/headline-roundup'

interface Props {
  readonly headlines: readonly HeadlineComparison[]
}

type Side = 'left' | 'center' | 'right'

const SIDE_LABEL: Record<Side, string> = {
  left: 'Left',
  center: 'Center',
  right: 'Right',
}

const SIDE_COL_START: Record<Side, string> = {
  left: 'md:col-start-1',
  center: 'md:col-start-2',
  right: 'md:col-start-3',
}

function countBuckets(roundup: HeadlineRoundupResult): number {
  return (roundup.left ? 1 : 0) + (roundup.center ? 1 : 0) + (roundup.right ? 1 : 0)
}

function Column({ side, headline }: { side: Side; headline: HeadlineComparison }) {
  return (
    <div
      className={`glass-sm p-4 space-y-2 ${SIDE_COL_START[side]}`}
      data-testid={`headline-roundup-${side}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`w-2.5 h-2.5 rounded-full ${BIAS_CSS_CLASS[headline.sourceBias]}`}
          aria-hidden="true"
        />
        <span className="text-[10px] font-semibold tracking-widest uppercase text-white/60">
          {SIDE_LABEL[side]}
        </span>
      </div>
      <p className="text-sm text-white/85 leading-snug">{headline.title}</p>
      <p className="text-xs text-white/50">
        {headline.sourceName}
        <span className="mx-1.5 text-white/20">·</span>
        {BIAS_LABELS[headline.sourceBias]}
      </p>
    </div>
  )
}

export function HeadlineRoundup({ headlines }: Props) {
  const roundup = selectHeadlineRoundup(headlines)
  if (countBuckets(roundup) < 2) return null

  return (
    <section
      className="glass p-4 space-y-3"
      aria-label="Headline roundup by political side"
    >
      <h3 className="text-xs font-semibold tracking-widest uppercase text-white/60">
        From Each Side
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {roundup.left && <Column side="left" headline={roundup.left} />}
        {roundup.center && <Column side="center" headline={roundup.center} />}
        {roundup.right && <Column side="right" headline={roundup.right} />}
      </div>
    </section>
  )
}
