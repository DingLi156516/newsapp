'use client'

/**
 * components/organisms/HeadlineComparison.tsx — How different outlets titled the same story.
 *
 * Shows each outlet's original article title, ordered by political bias
 * from left to right. The most visceral section of the story detail page.
 */

import type { HeadlineComparison as HeadlineComparisonType, BiasCategory } from '@/lib/types'
import { BIAS_LABELS, BIAS_CSS_CLASS } from '@/lib/types'

interface Props {
  readonly headlines: readonly HeadlineComparisonType[]
}

export function HeadlineComparison({ headlines }: Props) {
  if (headlines.length === 0) return null

  return (
    <section className="glass overflow-hidden" aria-label="Headline comparison across outlets">
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white/90 tracking-wide uppercase">
          How They Headlined It
        </h3>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {headlines.map((headline, i) => (
          <div key={i} className="px-5 py-3.5 flex items-start gap-3">
            <span
              className={`mt-1 flex-shrink-0 w-3 h-3 rounded-full ${BIAS_CSS_CLASS[headline.sourceBias]}`}
              title={BIAS_LABELS[headline.sourceBias as BiasCategory]}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm text-white/85 leading-snug">{headline.title}</p>
              <p className="mt-1 text-xs text-white/50">
                {headline.sourceName}
                <span className="mx-1.5 text-white/20">·</span>
                {BIAS_LABELS[headline.sourceBias as BiasCategory]}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
