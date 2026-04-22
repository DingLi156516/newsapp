/**
 * NexusCard — Main article card for the news feed.
 * Adapted from web with Pressable instead of motion.article.
 */

import { View, Text, Pressable } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { Image } from 'expo-image'
import { ArrowRight } from 'lucide-react-native'
import type { NewsArticle } from '@/lib/shared/types'
import { TOPIC_LABELS } from '@/lib/shared/types'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { CoverageCount } from '@/components/atoms/CoverageCount'
import { BlindspotBadge } from '@/components/atoms/BlindspotBadge'
import { BookmarkButton } from '@/components/atoms/BookmarkButton'
import { ShareButton } from '@/components/atoms/ShareButton'
import { SpectrumBar } from '@/components/molecules/SpectrumBar'
import { MetricsRow } from '@/components/molecules/MetricsRow'
import { GlassView } from '@/components/ui/GlassView'
import { BADGE } from '@/lib/shared/design'
import { useTheme } from '@/lib/shared/theme'
import { SPACING } from '@/lib/ui/tokens'

export interface FooterBand {
  readonly label: string
  readonly tone: 'warning' | 'info'
}

interface Props {
  readonly article: NewsArticle
  readonly onSave: (id: string) => void
  readonly isSaved: boolean
  readonly onClick: () => void
  readonly compact?: boolean
  readonly isRead?: boolean
  readonly showMetrics?: boolean
  readonly footerBand?: FooterBand
}

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function NexusCard({ article, onSave, isSaved, onClick, compact = false, isRead = false, showMetrics = false, footerBand }: Props) {
  const theme = useTheme()
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const pillStyle = {
    backgroundColor: theme.surface.glassPill,
    borderWidth: 0.5,
    borderColor: theme.surface.borderPill,
    borderRadius: BADGE.borderRadius,
    paddingHorizontal: BADGE.paddingH,
    paddingVertical: BADGE.paddingV,
  } as const

  return (
    <Pressable
      testID="story-card"
      onPress={onClick}
      onPressIn={() => { scale.value = withSpring(0.97) }}
      onPressOut={() => { scale.value = withSpring(1) }}
    >
      <Animated.View style={animatedStyle}>
      <GlassView variant={compact ? 'sm' : 'default'} style={{ overflow: 'hidden' }}>
        {/* Background image at low opacity for texture */}
        {!compact && article.imageUrl && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.06 }}>
            <Image
              source={{ uri: article.imageUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          </View>
        )}

        <View style={{ padding: compact ? 14 : 20, gap: compact ? 8 : 12 }}>
          <View style={{ flexDirection: 'row', gap: compact && article.imageUrl ? 12 : 0 }}>
            {/* Main content */}
            <View style={{ flex: 1, gap: compact ? 8 : 12 }}>
              {/* Top row: badges + bookmark */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, flex: 1 }}>
                  <CoverageCount count={article.sourceCount} />
                  {article.isBlindspot && <BlindspotBadge />}
                  {isRead && (
                    <View style={pillStyle}>
                      <Text style={{ fontFamily: 'Inter', fontSize: BADGE.fontSize, color: theme.text.tertiary }}>Read</Text>
                    </View>
                  )}
                  <View style={pillStyle}>
                    <Text style={{ fontFamily: 'Inter', fontSize: BADGE.fontSize, color: theme.text.secondary }}>
                      {TOPIC_LABELS[article.topic]}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ShareButton
                    url={`/story/${article.id}`}
                    title={article.headline}
                    size={compact ? 14 : 18}
                    storyId={article.id}
                  />
                  <BookmarkButton
                    isSaved={isSaved}
                    onPress={() => onSave(article.id)}
                    size={compact ? 16 : 20}
                  />
                </View>
              </View>

              {/* Headline */}
              <Text
                style={{
                  fontFamily: 'DMSerifDisplay',
                  fontSize: compact ? 14 : 20,
                  lineHeight: compact ? 20 : 28,
                  color: isRead ? theme.text.tertiary : theme.text.primary,
                }}
                numberOfLines={compact ? 2 : 3}
              >
                {article.headline}
              </Text>

              {/* Bottom row: factuality + time */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FactualityBar level={article.factuality} />
                <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.text.secondary, marginLeft: 'auto' }}>
                  {formatTimeAgo(article.timestamp)}
                </Text>
              </View>
            </View>

            {/* Compact thumbnail */}
            {compact && article.imageUrl && (
              <View style={{ width: 72, height: 72, borderRadius: 10, overflow: 'hidden', alignSelf: 'center' }}>
                <Image
                  source={{ uri: article.imageUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              </View>
            )}
          </View>

          {/* Trending metrics — shown only when the tab sorts by trending */}
          {showMetrics && (
            <MetricsRow
              impactScore={article.impactScore}
              articles24h={article.storyVelocity?.articles_24h ?? null}
              sourceDiversity={article.sourceDiversity}
            />
          )}

          {/* Spectrum bar */}
          <SpectrumBar segments={article.spectrumSegments} height={6} />
        </View>

        {footerBand && (
          <View
            testID="nexus-card-footer-band"
            style={{
              paddingHorizontal: compact ? 14 : 20,
              paddingVertical: SPACING.xs + 2,
              backgroundColor:
                footerBand.tone === 'warning'
                  ? theme.semantic.warning.bg
                  : theme.semantic.info.bg,
              borderTopWidth: 0.5,
              borderTopColor:
                footerBand.tone === 'warning'
                  ? theme.semantic.warning.border
                  : theme.semantic.info.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ArrowRight
              size={12}
              color={
                footerBand.tone === 'warning'
                  ? theme.semantic.warning.color
                  : theme.semantic.info.color
              }
            />
            <Text
              style={{
                fontFamily: 'Inter',
                fontSize: 11,
                lineHeight: 16,
                color:
                  footerBand.tone === 'warning'
                    ? theme.semantic.warning.color
                    : theme.semantic.info.color,
              }}
            >
              {footerBand.label}
            </Text>
          </View>
        )}
      </GlassView>
      </Animated.View>
    </Pressable>
  )
}
