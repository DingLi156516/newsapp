/**
 * KeyQuotesCarousel — Horizontal swipeable carousel of key quotes.
 * Uses FlatList with snap-to-item behavior and pagination dots.
 */

import { useState, useCallback, useEffect } from 'react'
import { View, Text, FlatList, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
import { GlassView } from '@/components/ui/GlassView'
import { SPACING, FONT } from '@/lib/shared/design'
import type { KeyQuote, BiasCategory } from '@/lib/shared/types'
import { BIAS_COLOR, BIAS_LABELS } from '@/lib/shared/types'
import { useTheme } from '@/lib/shared/theme'

interface Props {
  readonly quotes: readonly KeyQuote[]
}

const CARD_GAP = 12
const HORIZONTAL_PADDING = 16

function QuoteCard({ quote, cardWidth }: { quote: KeyQuote; cardWidth: number }) {
  const theme = useTheme()
  const color = BIAS_COLOR[quote.sourceBias as BiasCategory] ?? '#A1A1AA'

  return (
    <GlassView style={{ width: cardWidth, padding: SPACING.lg }}>
      <Text style={{
        fontFamily: 'Inter',
        fontSize: 15,
        lineHeight: 22,
        color: theme.text.primary,
        fontStyle: 'italic',
      }}>
        {'\u201C'}{quote.text}{'\u201D'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SPACING.md }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ fontFamily: FONT.caption.family, fontSize: FONT.caption.size, color: theme.text.tertiary }}>
          {quote.sourceName}
          {BIAS_LABELS[quote.sourceBias as BiasCategory] && (
            <>
              <Text style={{ color: theme.text.muted }}> {'\u00B7'} </Text>
              {BIAS_LABELS[quote.sourceBias as BiasCategory]}
            </>
          )}
        </Text>
      </View>
    </GlassView>
  )
}

export function KeyQuotesCarousel({ quotes }: Props) {
  if (!quotes || quotes.length === 0) return null

  const theme = useTheme()
  const { width: screenWidth } = useWindowDimensions()
  const cardWidth = screenWidth - HORIZONTAL_PADDING * 2
  const snapInterval = cardWidth + CARD_GAP
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (activeIndex >= quotes.length) {
      setActiveIndex(Math.max(0, quotes.length - 1))
    }
  }, [quotes.length, activeIndex])

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.x
    const index = Math.min(Math.max(0, Math.round(offset / snapInterval)), quotes.length - 1)
    setActiveIndex(index)
  }, [snapInterval])

  return (
    <View style={{ gap: SPACING.sm }}>
      <Text style={{
        fontFamily: 'Inter-SemiBold',
        fontSize: FONT.body.size,
        color: theme.text.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        paddingHorizontal: HORIZONTAL_PADDING,
      }}>
        Key Quotes
      </Text>

      {/* Semantic prefix + index: KeyQuote has no id field and this list is static
         API data that never reorders, so index keys are safe for reconciliation. */}
      <FlatList
        data={quotes as KeyQuote[]}
        keyExtractor={(item, i) => `${item.sourceName}-${i}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING, gap: CARD_GAP }}
        renderItem={({ item }) => <QuoteCard quote={item} cardWidth={cardWidth} />}
      />

      {/* Pagination dots */}
      {quotes.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          {quotes.map((q, i) => (
            <View
              key={`dot-${q.sourceName}-${i}`}
              style={{
                width: activeIndex === i ? 16 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: activeIndex === i
                  ? `rgba(${theme.inkRgb}, 0.6)`
                  : `rgba(${theme.inkRgb}, 0.15)`,
              }}
            />
          ))}
        </View>
      )}
    </View>
  )
}
