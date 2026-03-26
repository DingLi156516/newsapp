/**
 * NexusCard — Main article card for the news feed.
 * Adapted from web with Pressable instead of motion.article.
 */

import { View, Text, Pressable } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { Image } from 'expo-image'
import type { NewsArticle } from '@/lib/shared/types'
import { TOPIC_LABELS } from '@/lib/shared/types'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { CoverageCount } from '@/components/atoms/CoverageCount'
import { BlindspotBadge } from '@/components/atoms/BlindspotBadge'
import { BookmarkButton } from '@/components/atoms/BookmarkButton'
import { ShareButton } from '@/components/atoms/ShareButton'
import { SpectrumBar } from '@/components/molecules/SpectrumBar'
import { GlassView } from '@/components/ui/GlassView'
import { BADGE, GLASS } from '@/lib/shared/design'

interface Props {
  readonly article: NewsArticle
  readonly onSave: (id: string) => void
  readonly isSaved: boolean
  readonly onClick: () => void
  readonly compact?: boolean
  readonly isRead?: boolean
}

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function NexusCard({ article, onSave, isSaved, onClick, compact = false, isRead = false }: Props) {
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

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
                    <View style={{
                      backgroundColor: GLASS.bgPill,
                      borderWidth: 0.5,
                      borderColor: GLASS.borderPill,
                      borderRadius: BADGE.borderRadius,
                      paddingHorizontal: BADGE.paddingH,
                      paddingVertical: BADGE.paddingV,
                    }}>
                      <Text style={{ fontFamily: 'Inter', fontSize: BADGE.fontSize, color: 'rgba(255, 255, 255, 0.4)' }}>Read</Text>
                    </View>
                  )}
                  <View style={{
                    backgroundColor: GLASS.bgPill,
                    borderWidth: 0.5,
                    borderColor: GLASS.borderPill,
                    borderRadius: BADGE.borderRadius,
                    paddingHorizontal: BADGE.paddingH,
                    paddingVertical: BADGE.paddingV,
                  }}>
                    <Text style={{ fontFamily: 'Inter', fontSize: BADGE.fontSize, color: 'rgba(255, 255, 255, 0.7)' }}>
                      {TOPIC_LABELS[article.topic]}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ShareButton
                    url={`/story/${article.id}`}
                    title={article.headline}
                    size={compact ? 14 : 18}
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
                  color: isRead ? 'rgba(255, 255, 255, 0.5)' : 'white',
                }}
                numberOfLines={compact ? 2 : 3}
              >
                {article.headline}
              </Text>

              {/* Bottom row: factuality + time */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FactualityBar level={article.factuality} />
                <Text style={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', marginLeft: 'auto' }}>
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

          {/* Spectrum bar */}
          <SpectrumBar segments={article.spectrumSegments} height={6} />
        </View>
      </GlassView>
      </Animated.View>
    </Pressable>
  )
}
