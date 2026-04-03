'use client'

/**
 * components/organisms/KeyQuotes.tsx — Notable quotes from story coverage.
 *
 * Displays 1-3 key quotes extracted by AI, with source attribution and bias indicator.
 */

import type { KeyQuote, BiasCategory } from '@/lib/types'
import { BIAS_LABELS, BIAS_CSS_CLASS } from '@/lib/types'

interface Props {
  readonly quotes: readonly KeyQuote[]
}

export function KeyQuotes({ quotes }: Props) {
  if (quotes.length === 0) return null

  return (
    <section className="glass overflow-hidden" aria-label="Key quotes from coverage">
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white/90 tracking-wide uppercase">
          Key Quotes
        </h3>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {quotes.map((quote, i) => (
          <blockquote key={i} className="px-5 py-4">
            <p className="text-sm text-white/80 leading-relaxed italic">
              &ldquo;{quote.text}&rdquo;
            </p>
            <footer className="mt-2 flex items-center gap-2">
              <span
                className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${BIAS_CSS_CLASS[quote.sourceBias as BiasCategory] ?? ''}`}
                aria-hidden="true"
              />
              <cite className="text-xs text-white/50 not-italic">
                {quote.sourceName}
                {BIAS_LABELS[quote.sourceBias as BiasCategory] && (
                  <>
                    <span className="mx-1.5 text-white/20">·</span>
                    {BIAS_LABELS[quote.sourceBias as BiasCategory]}
                  </>
                )}
              </cite>
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  )
}
