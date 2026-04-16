/**
 * Story Detail screen — Shows full story with spectrum bar, AI tabs, timeline, sources.
 * Uses useLocalSearchParams() instead of Next.js use(params).
 * Parallax hero image + sticky mini-header on scroll.
 */

import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { ChevronLeft } from 'lucide-react-native'
import { useCallback } from 'react'
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated'
import { useStory } from '@/lib/hooks/use-story'
import { useStoryTimeline } from '@/lib/hooks/use-story-timeline'
import { useBookmarks } from '@/lib/hooks/use-bookmarks'
import { useReadingHistory } from '@/lib/hooks/use-reading-history'
import { useToast } from '@/lib/hooks/use-toast'
import { TOPIC_LABELS, BIAS_LABELS, BIAS_COLOR } from '@/lib/shared/types'
import { SEMANTIC, FONT, SPACING } from '@/lib/shared/design'
import { GlassView } from '@/components/ui/GlassView'
import { SpectrumBar } from '@/components/molecules/SpectrumBar'
import { SourceList } from '@/components/molecules/SourceList'
import { CoverageCount } from '@/components/atoms/CoverageCount'
import { BlindspotBadge } from '@/components/atoms/BlindspotBadge'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { GuideLink } from '@/components/atoms/GuideLink'
import { BookmarkButton } from '@/components/atoms/BookmarkButton'
import { ShareButton } from '@/components/atoms/ShareButton'
import { AISummaryTabs } from '@/components/organisms/AISummaryTabs'
import { CoverageIntelligence } from '@/components/organisms/CoverageIntelligence'
import { StoryTimeline } from '@/components/organisms/StoryTimeline'
import { MomentumBadge } from '@/components/atoms/MomentumBadge'
import { StoryTagsRow } from '@/components/molecules/StoryTagsRow'
import { usePromotedTags } from '@/lib/hooks/use-promoted-tags'
import { HeadlineComparisonList } from '@/components/organisms/HeadlineComparisonList'
import { KeyQuotesCarousel } from '@/components/organisms/KeyQuotesCarousel'
import { ClaimsComparison } from '@/components/organisms/ClaimsComparison'
import { StoryScores } from '@/components/molecules/StoryScores'
import { ScrollProgressBar } from '@/components/atoms/ScrollProgressBar'

const HERO_HEIGHT = 200
const MINI_HEADER_HEIGHT = 56

export default function StoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { story, isLoading, isError } = useStory(id)
  const { timeline } = useStoryTimeline(id)
  const { isBookmarked, toggle } = useBookmarks()
  const { markAsRead } = useReadingHistory()
  const { showToast } = useToast()
  const { tags: promotedTags } = usePromotedTags()

  const scrollY = useSharedValue(0)
  const [contentHeight, setContentHeight] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y
    },
  })

  const promotedSlugs = useMemo(
    () => new Set(promotedTags.map((t) => `${t.slug}:${t.type}`)),
    [promotedTags]
  )

  const toggleWithToast = useCallback(async (storyId: string) => {
    const wasSaved = isBookmarked(storyId)
    await toggle(storyId)
    showToast({
      message: wasSaved ? 'Removed from bookmarks' : 'Story saved',
      variant: wasSaved ? 'info' : 'success',
      onUndo: () => toggle(storyId, wasSaved ? 'add' : 'remove'),
    })
  }, [toggle, isBookmarked, showToast])

  // Auto-mark story as read on view
  useEffect(() => {
    if (story && id) {
      markAsRead(id)
    }
  }, [story, id, markAsRead])

  // Parallax style for hero image
  const heroParallaxStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [0, HERO_HEIGHT], [0, -HERO_HEIGHT * 0.5], Extrapolation.CLAMP) },
    ],
  }))

  // Gradient overlay intensifies with scroll
  const heroOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HERO_HEIGHT], [0.5, 1], Extrapolation.CLAMP),
  }))

  // Sticky mini-header fades in after scrolling past hero
  const miniHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [150, 220], [0, 1], Extrapolation.CLAMP),
    pointerEvents: scrollY.value > 150 ? 'auto' as const : 'none' as const,
  }))

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="white" size="large" />
      </SafeAreaView>
    )
  }

  if (isError || !story) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Inter', fontSize: 16, color: 'rgba(255, 255, 255, 0.5)' }}>
          Story not found
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: 'Inter', fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>
            Go back
          </Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top']}>
      {/* Scroll progress bar */}
      <ScrollProgressBar scrollY={scrollY} contentHeight={contentHeight} viewportHeight={viewportHeight} />

      {/* Sticky mini-header — fades in after scrolling past hero */}
      <Animated.View style={[styles.miniHeader, miniHeaderStyle]}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 10, 10, 0.8)' }} />
        </BlurView>
        <View style={styles.miniHeaderContent}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ChevronLeft size={18} color="rgba(255, 255, 255, 0.7)" />
          </Pressable>
          <Text style={styles.miniHeaderTitle} numberOfLines={1}>
            {story.headline}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ShareButton url={`/story/${story.id}`} title={story.headline} size={16} />
            <BookmarkButton
              isSaved={isBookmarked(story.id)}
              onPress={() => toggleWithToast(story.id)}
              size={16}
            />
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_, h) => setContentHeight(h)}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
      >
        {/* Header with back button */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
          <Pressable testID="back-button" onPress={() => router.back()} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ChevronLeft size={20} color="rgba(255, 255, 255, 0.7)" />
            <Text style={{ fontFamily: 'Inter', fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>Back</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ShareButton url={`/story/${story.id}`} title={story.headline} />
            <BookmarkButton
              isSaved={isBookmarked(story.id)}
              onPress={() => toggleWithToast(story.id)}
            />
          </View>
        </View>

        {/* Hero image with parallax */}
        {story.imageUrl && (
          <View style={{ height: HERO_HEIGHT, marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', marginBottom: 16 }}>
            <Animated.View style={[{ width: '100%', height: HERO_HEIGHT * 1.3 }, heroParallaxStyle]}>
              <Image
                source={{ uri: story.imageUrl }}
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                transition={300}
                style={{ width: '100%', height: '100%', opacity: 0.7 }}
                contentFit="cover"
              />
            </Animated.View>
            <Animated.View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 }, heroOverlayStyle]}>
              <LinearGradient
                colors={['transparent', '#0A0A0A']}
                style={{ width: '100%', height: '100%' }}
              />
            </Animated.View>
          </View>
        )}

        <View style={{ paddingHorizontal: 16, gap: 16 }}>
          {/* Badges */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <View style={{
              backgroundColor: 'rgba(26, 26, 26, 0.6)',
              borderRadius: 9999,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderWidth: 0.5,
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}>
              <Text style={{ fontFamily: 'Inter', fontSize: 11, color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {TOPIC_LABELS[story.topic]}
              </Text>
            </View>
            <CoverageCount count={story.sourceCount} />
            {story.sourceCount > 1 && story.isBlindspot && <BlindspotBadge />}
            {story.storyVelocity && <MomentumBadge phase={story.storyVelocity.phase} />}
            <FactualityBar level={story.factuality} />
            <GuideLink />
          </View>

          {/* Headline */}
          <Text testID="story-headline" style={{ fontFamily: 'DMSerifDisplay', fontSize: 26, lineHeight: 34, color: 'white' }}>
            {story.headline}
          </Text>

          {/* Tags — promoted tags become tappable for feed navigation */}
          {story.tags && story.tags.length > 0 && (
            <StoryTagsRow
              tags={story.tags}
              promotedSlugs={promotedSlugs}
              onTagPress={(tag) => router.push({ pathname: '/(tabs)', params: { tag: tag.slug, tag_type: tag.type } })}
            />
          )}

          {/* Spectrum bar (multi-source) or bias pill (single-source) */}
          {story.sourceCount > 1 ? (
            <SpectrumBar segments={story.spectrumSegments} height={14} showLabels />
          ) : story.sources[0] && (
            <View style={{ gap: 4 }}>
              <Text style={{ fontFamily: 'Inter', fontSize: 11, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Source Bias
              </Text>
              <View style={{
                alignSelf: 'flex-start',
                backgroundColor: 'rgba(26, 26, 26, 0.6)',
                borderRadius: 9999,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderWidth: 0.5,
                borderColor: BIAS_COLOR[story.sources[0].bias] + '40',
              }}>
                <Text style={{ fontFamily: 'Inter', fontSize: 12, color: BIAS_COLOR[story.sources[0].bias] }}>
                  {BIAS_LABELS[story.sources[0].bias]} source
                </Text>
              </View>
            </View>
          )}

          {/* Single-source coverage notice */}
          {story.sourceCount === 1 && (
            <GlassView style={{ padding: SPACING.md }}>
              <Text style={{
                fontFamily: FONT.body.family,
                fontSize: FONT.body.size - 1,
                lineHeight: 20,
                color: SEMANTIC.warning.color,
              }}>
                This story is based on a single source. Cross-spectrum analysis is limited —
                perspectives may update as more outlets cover this story.
              </Text>
            </GlassView>
          )}

          {/* AI Summary */}
          <AISummaryTabs
            commonGround={story.aiSummary.commonGround}
            leftFraming={story.aiSummary.leftFraming}
            rightFraming={story.aiSummary.rightFraming}
            sentiment={story.sentiment}
            sourceCount={story.sourceCount}
          />

          {/* Headline Comparison (multi-source only) */}
          {story.sourceCount > 1 && story.headlines && <HeadlineComparisonList headlines={story.headlines} />}

          {/* Key Quotes */}
          {story.keyQuotes && <KeyQuotesCarousel quotes={story.keyQuotes} />}

          {/* Claims */}
          {story.keyClaims && <ClaimsComparison claims={story.keyClaims} />}

          {/* Story Scores (hides diversity/controversy for single-source internally) */}
          <StoryScores
            impactScore={story.impactScore}
            sourceDiversity={story.sourceDiversity}
            controversyScore={story.controversyScore}
            sourceCount={story.sourceCount}
          />

          {/* Coverage Intelligence (multi-source only) */}
          {story.sourceCount > 1 && (
            <CoverageIntelligence article={story} timeline={timeline} />
          )}

          {/* Timeline (multi-source only) */}
          {story.sourceCount > 1 && timeline && timeline.events.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 16, color: 'white' }}>
                Coverage Timeline
              </Text>
              <Text style={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
                {timeline.totalArticles} articles over {Math.round(timeline.timeSpanHours)}h
              </Text>
              <StoryTimeline events={timeline.events} />
            </View>
          )}

          {/* Sources */}
          <GlassView style={{ padding: 16 }}>
            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 16, color: 'white', marginBottom: 8 }}>
              Sources ({story.sources.length})
            </Text>
            <SourceList sources={story.sources} />
          </GlassView>

          {/* Single-source CTA */}
          {story.sourceCount === 1 && (
            <Text style={{ fontFamily: 'Inter', fontSize: 13, color: 'rgba(255, 255, 255, 0.35)', textAlign: 'center', paddingVertical: 8 }}>
              Check back as more outlets cover this story
            </Text>
          )}
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  miniHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    height: MINI_HEADER_HEIGHT + 50, // account for safe area
    overflow: 'hidden',
  },
  miniHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 50, // safe area offset
    height: '100%',
  },
  miniHeaderTitle: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: 'white',
  },
})
