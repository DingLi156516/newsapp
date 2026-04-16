/**
 * Saved screen — List of bookmarked stories.
 */

import { useCallback, useMemo } from 'react'
import { View, Text, FlatList, Pressable } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { useStories } from '@/lib/hooks/use-stories'
import { useBookmarks } from '@/lib/hooks/use-bookmarks'
import { useReadingHistory } from '@/lib/hooks/use-reading-history'
import type { NewsArticle } from '@/lib/shared/types'
import { NexusCard } from '@/components/organisms/NexusCard'
import { SwipeableCard } from '@/components/molecules/SwipeableCard'
import { NexusCardSkeletonList } from '@/components/organisms/NexusCardSkeleton'
import { EmptyStateView } from '@/components/molecules/EmptyStateView'
import { useToast } from '@/lib/hooks/use-toast'
import { useTheme } from '@/lib/shared/theme'

export default function SavedScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { isBookmarked, toggle, bookmarkedIds } = useBookmarks()
  const { isRead } = useReadingHistory()
  const { showToast } = useToast()

  const toggleWithToast = useCallback(async (id: string) => {
    const wasSaved = isBookmarked(id)
    await toggle(id)
    showToast({
      message: wasSaved ? 'Removed from bookmarks' : 'Story saved',
      variant: wasSaved ? 'info' : 'success',
      onUndo: () => toggle(id, wasSaved ? 'add' : 'remove'),
    })
  }, [toggle, isBookmarked, showToast])

  const savedIds = useMemo(() => Array.from(bookmarkedIds), [bookmarkedIds])
  const { stories, isLoading } = useStories(
    savedIds.length > 0 ? { ids: savedIds } : null
  )

  const renderItem = useCallback(({ item, index }: { item: NewsArticle; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 60).springify().damping(18)}
      style={{ paddingHorizontal: 16, paddingVertical: 4 }}
    >
      <SwipeableCard
        storyId={item.id}
        storyTitle={item.headline}
        isSaved={isBookmarked(item.id)}
        onSave={toggleWithToast}
      >
        <NexusCard
          article={item}
          onClick={() => router.push(`/story/${item.id}`)}
          onSave={toggleWithToast}
          isSaved={isBookmarked(item.id)}
          isRead={isRead(item.id)}
          compact
        />
      </SwipeableCard>
    </Animated.View>
  ), [router, toggleWithToast, isBookmarked, isRead])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.background }} edges={['top']}>
      <FlatList
        data={stories}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
            <Pressable testID="back-button" onPress={() => router.back()} hitSlop={8}>
              <ChevronLeft size={20} color={theme.text.secondary} />
            </Pressable>
            <Text style={{ fontFamily: 'DMSerifDisplay', fontSize: 24, color: theme.text.primary }}>
              Saved Stories
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? <NexusCardSkeletonList count={3} /> : (
            <EmptyStateView
              icon="bookmark"
              title="No Saved Stories"
              message="Tap the bookmark icon on any story to save it here for later reading."
              actionLabel="Browse Stories"
              onAction={() => router.back()}
            />
          )
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  )
}
