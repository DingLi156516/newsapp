/**
 * CoverageIntelligence — Story detail section showing coverage analysis.
 * Ported from web CoverageIntelligence with RN views.
 */

import { useMemo } from 'react'
import { View, Text } from 'react-native'
import type { NewsArticle, StoryTimeline } from '@/lib/shared/types'
import { buildStoryIntelligence } from '@/lib/story-intelligence'
import { GlassView } from '@/components/ui/GlassView'
import { useTheme } from '@/lib/shared/theme'

interface Props {
  readonly article: NewsArticle
  readonly timeline: StoryTimeline | null
}

export function CoverageIntelligence({ article, timeline }: Props) {
  const theme = useTheme()
  const intelligence = useMemo(
    () => buildStoryIntelligence(article, timeline),
    [article, timeline]
  )

  return (
    <View style={{ gap: 8 }}>
      <Text style={{
        fontFamily: 'Inter',
        fontSize: 11,
        color: theme.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 2,
      }}>
        Coverage Intelligence
      </Text>

      <GlassView style={{ padding: 16, gap: 16 }}>
        {/* Coverage shape */}
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: theme.text.primary }}>
            Coverage shape
          </Text>
          <Text style={{ fontFamily: 'Inter', fontSize: 13, color: theme.text.secondary, lineHeight: 20 }}>
            {intelligence.overview}
          </Text>
        </View>

        {/* 2-column: momentum + gaps */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <IntelCard label="Coverage momentum" text={intelligence.momentumSummary} />
          <IntelCard label="Coverage gaps" text={intelligence.coverageGapSummary} />
        </View>

        {/* 2-column: framing + methodology */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <IntelCard label="Framing delta" text={intelligence.framingDeltaSummary} />
          <IntelCard label="How this story was assembled" text={intelligence.methodologySummary} />
        </View>
      </GlassView>
    </View>
  )
}

function IntelCard({ label, text }: { readonly label: string; readonly text: string }) {
  const theme = useTheme()
  return (
    <GlassView variant="sm" style={{ flex: 1, padding: 12, gap: 4 }}>
      <Text style={{
        fontFamily: 'Inter',
        fontSize: 10,
        color: theme.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
      }}>
        {label}
      </Text>
      <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.text.secondary, lineHeight: 18 }}>
        {text}
      </Text>
    </GlassView>
  )
}
