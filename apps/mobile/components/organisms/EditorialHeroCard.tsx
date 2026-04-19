/**
 * EditorialHeroCard — magazine-cover treatment for the first story on the
 * Home feed. Sibling to `HeroCard` (which stays available for non-feed
 * contexts). Key differences:
 *  - 2:3 aspect image, not 16:9 thumbnail
 *  - 32pt DM Serif Display headline with tight negative tracking
 *  - Single-line byline (topic · source count · relative time · factuality dot)
 *  - Tap-to-open with press-scale animation
 */

import { View, Pressable } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { Image } from 'expo-image'
import type { NewsArticle } from '@/lib/shared/types'
import { TOPIC_LABELS } from '@/lib/shared/types'
import { BookmarkButton } from '@/components/atoms/BookmarkButton'
import { ShareButton } from '@/components/atoms/ShareButton'
import { BlindspotBadge } from '@/components/atoms/BlindspotBadge'
import { SpectrumBar } from '@/components/molecules/SpectrumBar'
import { MetricsRow } from '@/components/molecules/MetricsRow'
import { FACTUALITY } from '@/lib/shared/design'
import { useTheme } from '@/lib/shared/theme'
import { Heading, Text, Surface, SPACING, RADIUS } from '@/lib/ui'

interface Props {
  readonly article: NewsArticle
  readonly onClick: () => void
  readonly onSave: (id: string) => void
  readonly isSaved: boolean
  readonly isRead?: boolean
  readonly showMetrics?: boolean
}

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function EditorialHeroCard({
  article,
  onClick,
  onSave,
  isSaved,
  isRead = false,
  showMetrics = false,
}: Props) {
  const theme = useTheme()
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))
  const factualityColor = FACTUALITY[article.factuality].color

  return (
    <Pressable
      testID="hero-card"
      onPress={onClick}
      onPressIn={() => { scale.value = withSpring(0.98) }}
      onPressOut={() => { scale.value = withSpring(1) }}
    >
      <Animated.View style={animatedStyle}>
        <Surface
          variant="glass"
          elevation="md"
          style={{ overflow: 'hidden', borderRadius: RADIUS.xxl }}
        >
          {article.imageUrl && (
            <View style={{ width: '100%', aspectRatio: 16 / 9, overflow: 'hidden' }}>
              <Image
                source={{ uri: article.imageUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            </View>
          )}

          <View style={{ padding: SPACING.lg, gap: SPACING.sm }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: SPACING.xs + 2,
                flexWrap: 'wrap',
              }}
            >
              <Text variant="overline" tone="tertiary">
                {TOPIC_LABELS[article.topic]}
              </Text>
              <Text variant="caption" tone="muted">·</Text>
              <Text variant="caption" tone="tertiary">
                {article.sourceCount} {article.sourceCount === 1 ? 'source' : 'sources'}
              </Text>
              <Text variant="caption" tone="muted">·</Text>
              <Text variant="caption" tone="tertiary">
                {formatTimeAgo(article.timestamp)}
              </Text>
              <View
                accessibilityLabel="Factuality"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: factualityColor,
                  marginLeft: 2,
                }}
              />
              {article.isBlindspot && (
                <View style={{ marginLeft: 'auto' }}>
                  <BlindspotBadge />
                </View>
              )}
            </View>

            <Heading
              variant="hero"
              tone={isRead ? 'tertiary' : 'primary'}
              numberOfLines={3}
            >
              {article.headline}
            </Heading>

            {showMetrics && (
              <MetricsRow
                impactScore={article.impactScore}
                articles24h={article.storyVelocity?.articles_24h ?? null}
                sourceDiversity={article.sourceDiversity}
              />
            )}

            <SpectrumBar segments={article.spectrumSegments} height={8} />

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: SPACING.md,
                paddingTop: SPACING.xs,
                borderTopWidth: 0.5,
                borderTopColor: theme.surface.border,
                marginTop: SPACING.xs,
              }}
            >
              <ShareButton
                url={`/story/${article.id}`}
                title={article.headline}
                size={18}
              />
              <BookmarkButton
                isSaved={isSaved}
                onPress={() => onSave(article.id)}
              />
            </View>
          </View>
        </Surface>
      </Animated.View>
    </Pressable>
  )
}
