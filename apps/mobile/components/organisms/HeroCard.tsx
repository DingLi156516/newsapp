/**
 * HeroCard — Full-width featured story card at top of feed.
 */

import { View, Text, Pressable } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { Image } from 'expo-image'
import type { NewsArticle } from '@/lib/shared/types'
import { TOPIC_LABELS } from '@/lib/shared/types'
import { CoverageCount } from '@/components/atoms/CoverageCount'
import { BlindspotBadge } from '@/components/atoms/BlindspotBadge'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { BookmarkButton } from '@/components/atoms/BookmarkButton'
import { ShareButton } from '@/components/atoms/ShareButton'
import { SpectrumBar } from '@/components/molecules/SpectrumBar'
import { GlassView } from '@/components/ui/GlassView'
import { BADGE, GLASS } from '@/lib/shared/design'

interface Props {
  readonly article: NewsArticle
  readonly onClick: () => void
  readonly onSave: (id: string) => void
  readonly isSaved: boolean
  readonly isRead?: boolean
}

export function HeroCard({ article, onClick, onSave, isSaved, isRead = false }: Props) {
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      testID="hero-card"
      onPress={onClick}
      onPressIn={() => { scale.value = withSpring(0.97) }}
      onPressOut={() => { scale.value = withSpring(1) }}
    >
      <Animated.View style={animatedStyle}>
      <GlassView style={{ overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', padding: 20, gap: 16 }}>
          <View style={{ flex: 1, gap: 8 }}>
            {/* Badges row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
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
              <CoverageCount count={article.sourceCount} />
              {article.isBlindspot && <BlindspotBadge />}
              {isRead && (
                <View style={{
                  backgroundColor: GLASS.bgPill,
                  borderRadius: BADGE.borderRadius,
                  paddingHorizontal: BADGE.paddingH,
                  paddingVertical: BADGE.paddingV,
                  borderWidth: 0.5,
                  borderColor: GLASS.borderPill,
                }}>
                  <Text style={{ fontFamily: 'Inter', fontSize: BADGE.fontSize, color: 'rgba(255, 255, 255, 0.4)' }}>Read</Text>
                </View>
              )}
              <FactualityBar level={article.factuality} />
              <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ShareButton url={`/story/${article.id}`} title={article.headline} size={18} />
                <BookmarkButton isSaved={isSaved} onPress={() => onSave(article.id)} />
              </View>
            </View>

            {/* Headline */}
            <Text
              style={{
                fontFamily: 'DMSerifDisplay',
                fontSize: 20,
                lineHeight: 28,
                color: isRead ? 'rgba(255, 255, 255, 0.5)' : 'white',
              }}
              numberOfLines={3}
            >
              {article.headline}
            </Text>

            {/* Spectrum bar */}
            <SpectrumBar segments={article.spectrumSegments} height={8} />
          </View>

          {/* Thumbnail */}
          {article.imageUrl && (
            <View style={{ width: 100, height: 100, borderRadius: 14, overflow: 'hidden' }}>
              <Image
                source={{ uri: article.imageUrl }}
                style={{ width: '100%', height: '100%', opacity: 0.85 }}
                contentFit="cover"
              />
            </View>
          )}
        </View>
      </GlassView>
      </Animated.View>
    </Pressable>
  )
}
