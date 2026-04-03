/**
 * components/atoms/SentimentIndicator.tsx — Sentiment label for political framing.
 *
 * Shows the detected emotional tone (angry, hopeful, critical, etc.)
 * as a small pill with an icon. Used inside AISummaryTabs.
 */

import type { SentimentLabel } from '@/lib/types'

interface Props {
  readonly sentiment: SentimentLabel
  readonly side?: 'left' | 'right'
}

const SENTIMENT_CONFIG: Record<SentimentLabel, { emoji: string; className: string }> = {
  angry: { emoji: '😠', className: 'bg-red-500/15 text-red-300' },
  fearful: { emoji: '😨', className: 'bg-purple-500/15 text-purple-300' },
  hopeful: { emoji: '🌟', className: 'bg-green-500/15 text-green-300' },
  neutral: { emoji: '😐', className: 'bg-zinc-500/15 text-zinc-400' },
  critical: { emoji: '🔍', className: 'bg-amber-500/15 text-amber-300' },
  celebratory: { emoji: '🎉', className: 'bg-emerald-500/15 text-emerald-300' },
}

const SENTIMENT_LABELS: Record<SentimentLabel, string> = {
  angry: 'Angry',
  fearful: 'Fearful',
  hopeful: 'Hopeful',
  neutral: 'Neutral',
  critical: 'Critical',
  celebratory: 'Celebratory',
}

export function SentimentIndicator({ sentiment, side }: Props) {
  const config = SENTIMENT_CONFIG[sentiment]
  const label = SENTIMENT_LABELS[sentiment]
  const ariaLabel = side ? `${side} sentiment: ${label}` : `Sentiment: ${label}`

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${config.className}`}
      aria-label={ariaLabel}
    >
      <span aria-hidden="true">{config.emoji}</span>
      {label}
    </span>
  )
}
