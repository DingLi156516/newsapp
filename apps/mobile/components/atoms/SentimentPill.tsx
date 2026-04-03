/**
 * SentimentPill — Inline emoji + label pill for sentiment display.
 * Used inside AISummaryTabs tab headers.
 */

import { View, Text } from 'react-native'
import type { SentimentLabel } from '@/lib/shared/types'
import { SENTIMENT_EMOJI, SENTIMENT_LABELS } from '@/lib/shared/types'

interface Props {
  readonly sentiment: SentimentLabel
}

const SENTIMENT_COLORS: Record<SentimentLabel, string> = {
  angry: '#EF4444',
  fearful: '#A855F7',
  hopeful: '#22C55E',
  neutral: '#A1A1AA',
  critical: '#F59E0B',
  celebratory: '#10B981',
}

export function SentimentPill({ sentiment }: Props) {
  const color = SENTIMENT_COLORS[sentiment]

  return (
    <View
      accessibilityLabel={`Sentiment: ${SENTIMENT_LABELS[sentiment]}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: `${color}18`,
        borderRadius: 9999,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      <Text style={{ fontSize: 10 }}>{SENTIMENT_EMOJI[sentiment]}</Text>
      <Text style={{ fontFamily: 'Inter', fontSize: 10, color }}>
        {SENTIMENT_LABELS[sentiment]}
      </Text>
    </View>
  )
}
