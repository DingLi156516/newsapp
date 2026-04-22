/**
 * HotNowCard — Horizontal strip of stories ranked by recent unique-viewer
 * count (last 6h). Mirrors the web Hot Now dashboard card.
 */

import { useCallback } from 'react'
import { View, ScrollView, Text, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { Flame } from 'lucide-react-native'
import { Image } from 'expo-image'
import { useHotStories } from '@/lib/hooks/use-hot-stories'
import { useTheme } from '@/lib/shared/theme'
import { Heading, Text as UiText } from '@/lib/ui/primitives'
import { Surface } from '@/lib/ui/primitives/Surface'
import { Skeleton } from '@/components/atoms/Skeleton'
import { SPACING } from '@/lib/ui/tokens'

export function HotNowCard() {
  const router = useRouter()
  const theme = useTheme()
  const { hotStories, isLoading, isError } = useHotStories()

  const onPressStory = useCallback(
    (id: string) => {
      router.push(`/story/${id}`)
    },
    [router]
  )

  return (
    <View testID="hot-now-section" style={{ gap: SPACING.sm + 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.lg }}>
        <View style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: theme.surface.glassPill,
          borderWidth: 0.5,
          borderColor: theme.surface.borderPill,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Flame size={14} color="#ffb38a" />
        </View>
        <Heading variant="title">Hot Now</Heading>
        <UiText variant="bodySm" tone="tertiary" style={{ marginLeft: 4 }}>
          last 6h
        </UiText>
      </View>

      {isLoading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: SPACING.sm }}
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ width: 220, height: 120, borderRadius: 16 }} />
          ))}
        </ScrollView>
      ) : isError ? (
        <Surface style={{ marginHorizontal: SPACING.lg, padding: SPACING.lg, alignItems: 'center' }}>
          <UiText variant="bodySm" tone="secondary">
            Couldn&apos;t load hot stories.
          </UiText>
        </Surface>
      ) : hotStories.length === 0 ? (
        <Surface
          testID="hot-now-empty"
          style={{ marginHorizontal: SPACING.lg, padding: SPACING.xl, alignItems: 'center' }}
        >
          <UiText variant="bodySm" tone="tertiary" style={{ textAlign: 'center' }}>
            No engagement data yet. Hot Now fills in as readers start opening stories.
          </UiText>
        </Surface>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: SPACING.sm }}
        >
          {hotStories.map((story) => (
            <Pressable
              key={story.id}
              testID={`hot-now-card-${story.id}`}
              onPress={() => onPressStory(story.id)}
              style={{ width: 220 }}
            >
              <Surface variant="glassSm" style={{ overflow: 'hidden', borderRadius: 16 }}>
                {story.imageUrl && (
                  <Image
                    source={{ uri: story.imageUrl }}
                    style={{ width: '100%', height: 90, opacity: 0.7 }}
                    contentFit="cover"
                  />
                )}
                <View style={{ padding: SPACING.md, gap: SPACING.xs }}>
                  <Text
                    numberOfLines={2}
                    style={{ fontFamily: 'Inter-SemiBold', fontSize: 13, color: theme.text.primary }}
                  >
                    {story.headline}
                  </Text>
                  <UiText variant="bodySm" tone="tertiary">
                    {story.uniqueViewers6h.toLocaleString()} reading
                  </UiText>
                </View>
              </Surface>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  )
}
