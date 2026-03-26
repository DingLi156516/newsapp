/**
 * History screen — List of previously read stories.
 */

import { useCallback } from 'react'
import { View, Text, FlatList, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { useStories } from '@/lib/hooks/use-stories'
import { useReadingHistory } from '@/lib/hooks/use-reading-history'
import { useBookmarks } from '@/lib/hooks/use-bookmarks'
import { useToast } from '@/lib/hooks/use-toast'
import type { NewsArticle } from '@/lib/shared/types'
import { NexusCard } from '@/components/organisms/NexusCard'
import { NexusCardSkeletonList } from '@/components/organisms/NexusCardSkeleton'
import { EmptyStateView } from '@/components/molecules/EmptyStateView'

export default function HistoryScreen() {
  const router = useRouter()
  const { readStoryIds } = useReadingHistory()
  const { isBookmarked, toggle } = useBookmarks()
  const { showToast } = useToast()

  const { stories, isLoading } = useStories(
    readStoryIds.length > 0 ? { ids: readStoryIds } : null
  )

  const toggleWithToast = useCallback(async (id: string) => {
    const wasSaved = isBookmarked(id)
    await toggle(id)
    showToast({
      message: wasSaved ? 'Removed from bookmarks' : 'Story saved',
      variant: wasSaved ? 'info' : 'success',
      onUndo: () => toggle(id, wasSaved ? 'add' : 'remove'),
    })
  }, [toggle, isBookmarked, showToast])

  const renderItem = useCallback(({ item }: { item: NewsArticle }) => (
    <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
      <NexusCard
        article={item}
        onClick={() => router.push(`/story/${item.id}`)}
        onSave={toggleWithToast}
        isSaved={isBookmarked(item.id)}
        isRead
        compact
      />
    </View>
  ), [router, toggleWithToast, isBookmarked])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top']}>
      <FlatList
        data={stories}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
            <Pressable testID="back-button" onPress={() => router.back()} hitSlop={8}>
              <ChevronLeft size={20} color="rgba(255, 255, 255, 0.7)" />
            </Pressable>
            <Text style={{ fontFamily: 'DMSerifDisplay', fontSize: 24, color: 'white' }}>
              Reading History
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? <NexusCardSkeletonList count={3} /> : (
            <EmptyStateView
              icon="book"
              title="No History Yet"
              message="Stories you read will appear here. Start exploring to build your reading history and bias profile."
              actionLabel="Explore Feed"
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
