/**
 * Source Profile screen — Surface a single news outlet's bias position,
 * factuality, ownership, and recent coverage. Tapping sources anywhere
 * in the app lands here (the external domain becomes a secondary CTA).
 */

import { useCallback } from 'react'
import { View, Text, Pressable, Linking, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft, ExternalLink, AlertTriangle } from 'lucide-react-native'
import {
  BIAS_LABELS,
  BIAS_COLOR,
  FACTUALITY_LABELS,
  OWNERSHIP_LABELS,
  TOPIC_LABELS,
  ALL_BIASES,
  FACTUALITY_RANK,
  type BiasCategory,
} from '@/lib/shared/types'
import { useSource } from '@/lib/hooks/use-source'
import { GlassView } from '@/components/ui/GlassView'
import { SourceLogo } from '@/components/atoms/SourceLogo'
import { BlindspotBadge } from '@/components/atoms/BlindspotBadge'
import { NetworkErrorView } from '@/components/molecules/NetworkErrorView'
import { EmptyStateView } from '@/components/molecules/EmptyStateView'
import { useTheme } from '@/lib/shared/theme'
import { TOUCH_TARGET } from '@/lib/shared/design'

const RECENT_STORIES_LIMIT = 8
const FACTUALITY_DOT_COUNT = 5

function safeTimeAgo(timestamp: string): string {
  const ms = Date.now() - Date.parse(timestamp)
  if (Number.isNaN(ms) || ms < 0) return ''
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.round(hr / 24)
  return `${d}d ago`
}

export default function SourceProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const theme = useTheme()
  const { profile, isLoading, isError, mutate } = useSource(slug)

  const openExternal = useCallback(() => {
    if (profile?.source.url) {
      Linking.openURL(`https://${profile.source.url}`)
    }
  }, [profile])

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.text.primary} size="large" />
      </SafeAreaView>
    )
  }

  if (isError || !profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.background }} edges={['top']}>
        <Header onBack={() => router.back()} theme={theme} />
        {isError ? (
          <NetworkErrorView onRetry={() => mutate()} />
        ) : (
          <EmptyStateView icon="search" title="Source not found" message="We couldn't load that source. It may have been removed." />
        )}
      </SafeAreaView>
    )
  }

  const { source, recentStories, blindspotCount } = profile
  const ownershipTypeLabel = source.ownership ? OWNERSHIP_LABELS[source.ownership] : 'Newspaper'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.background }} edges={['top']}>
      <Header onBack={() => router.back()} theme={theme} />

      <ScrollView
        testID="source-profile-scroll"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity */}
        <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <SourceLogo domain={source.url} name={source.name} bias={source.bias} size={46} />
            <View style={{ flex: 1 }}>
              <Text
                testID="source-profile-name"
                style={{ fontFamily: 'DMSerifDisplay', fontSize: 22, color: theme.text.primary }}
              >
                {source.name}
              </Text>
              <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.text.tertiary }}>
                {source.url ? `${source.url} · ${ownershipTypeLabel}` : ownershipTypeLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Bias position card */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <BiasPositionCard bias={source.bias} />
        </View>

        {/* Factuality card */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <FactualityCard level={source.factuality} />
        </View>

        {/* Blindspot callout */}
        {blindspotCount > 0 && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} color={theme.semantic.warning.color} />
              <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.text.secondary }}>
                {blindspotCount} recent {blindspotCount === 1 ? 'story' : 'stories'} tagged as a blindspot
              </Text>
            </View>
          </View>
        )}

        {/* Recent stories */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.text.primary }}>
            Recent coverage
          </Text>
          {recentStories.length === 0 ? (
            <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.text.tertiary }}>
              No recent stories from this source.
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {recentStories.slice(0, RECENT_STORIES_LIMIT).map((story) => (
                <Pressable
                  key={story.id}
                  testID={`source-profile-story-${story.id}`}
                  onPress={() => router.push(`/story/${story.id}`)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <GlassView variant="sm" style={{ padding: 12, gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={{ fontFamily: 'Inter', fontSize: 10, color: theme.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {TOPIC_LABELS[story.topic]}
                      </Text>
                      <Text style={{ fontFamily: 'Inter', fontSize: 10, color: theme.text.muted }}>
                        · {safeTimeAgo(story.timestamp)}
                      </Text>
                      {story.isBlindspot && <BlindspotBadge />}
                    </View>
                    <Text
                      style={{ fontFamily: 'Inter-Medium', fontSize: 14, lineHeight: 20, color: theme.text.primary }}
                      numberOfLines={2}
                    >
                      {story.headline}
                    </Text>
                  </GlassView>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Visit CTA */}
        {source.url && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Pressable
              testID="source-profile-visit"
              onPress={openExternal}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 0.5,
                borderColor: theme.surface.borderPill,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontFamily: 'Inter', fontSize: 13, color: theme.text.secondary }}>
                {`Visit ${source.url}`}
              </Text>
              <ExternalLink size={14} color={theme.text.tertiary} />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Header({
  onBack,
  theme,
}: {
  readonly onBack: () => void
  readonly theme: ReturnType<typeof useTheme>
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
      }}
    >
      <Pressable
        testID="source-profile-back"
        onPress={onBack}
        hitSlop={TOUCH_TARGET.hitSlop}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      >
        <ChevronLeft size={20} color={theme.text.secondary} />
        <Text style={{ fontFamily: 'Inter', fontSize: 14, color: theme.text.secondary }}>Back</Text>
      </Pressable>
    </View>
  )
}

function BiasPositionCard({ bias }: { readonly bias: BiasCategory }) {
  const theme = useTheme()
  return (
    <GlassView variant="sm" testID="source-profile-bias" style={{ padding: 14, gap: 10 }}>
      <Text style={{ fontFamily: 'Inter', fontSize: 10, color: theme.text.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
        Bias Position
      </Text>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {ALL_BIASES.map((b) => {
          const isActive = b === bias
          return (
            <View
              key={b}
              style={{
                flex: 1,
                height: 10,
                borderRadius: 3,
                backgroundColor: isActive ? BIAS_COLOR[b] : `${BIAS_COLOR[b]}33`,
              }}
            />
          )
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: 'Inter', fontSize: 10, color: theme.text.muted }}>Far Left</Text>
        <Text style={{ fontFamily: 'Inter', fontSize: 10, color: theme.text.muted }}>Center</Text>
        <Text style={{ fontFamily: 'Inter', fontSize: 10, color: theme.text.muted }}>Far Right</Text>
      </View>
      <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: BIAS_COLOR[bias] }}>
        {BIAS_LABELS[bias]}
      </Text>
    </GlassView>
  )
}

function FactualityCard({ level }: { readonly level: import('@/lib/shared/types').FactualityLevel }) {
  const theme = useTheme()
  // rank: 0 (very-low) → 4 (very-high); fillCount 1..5
  const fillCount = FACTUALITY_RANK[level] + 1

  return (
    <GlassView variant="sm" testID="source-profile-factuality" style={{ padding: 14, gap: 10 }}>
      <Text style={{ fontFamily: 'Inter', fontSize: 10, color: theme.text.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
        Factuality
      </Text>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        {Array.from({ length: FACTUALITY_DOT_COUNT }, (_, i) => (
          <View
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: i < fillCount ? theme.text.primary : `rgba(${theme.inkRgb}, 0.1)`,
            }}
          />
        ))}
        <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, color: theme.text.secondary, marginLeft: 6 }}>
          {FACTUALITY_LABELS[level]} · {fillCount}/{FACTUALITY_DOT_COUNT}
        </Text>
      </View>
    </GlassView>
  )
}
