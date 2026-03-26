/**
 * Home Feed screen — Unified tab bar with feeds and topics as peers.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import type { NewsArticle, UnifiedTab, FeedSort } from '@/lib/shared/types'
import { PERSPECTIVE_BIASES, isTopicTab } from '@/lib/shared/types'
import { useStories } from '@/lib/hooks/use-stories'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useBookmarks } from '@/lib/hooks/use-bookmarks'
import { useReadingHistory } from '@/lib/hooks/use-reading-history'
import { useForYou } from '@/lib/hooks/use-for-you'
import { useVisibleTabs } from '@/lib/hooks/use-visible-tabs'
import { NexusCard } from '@/components/organisms/NexusCard'
import { NexusCardSkeleton, NexusCardSkeletonList } from '@/components/organisms/NexusCardSkeleton'
import { HeroCard } from '@/components/organisms/HeroCard'
import { UnifiedTabBar } from '@/components/organisms/UnifiedTabBar'
import { EditFeedModal } from '@/components/organisms/EditFeedModal'
import { SearchBar } from '@/components/organisms/SearchBar'
import { EmptyStateView } from '@/components/molecules/EmptyStateView'
import { NetworkErrorView } from '@/components/molecules/NetworkErrorView'
import { ForYouCta } from '@/components/molecules/ForYouCta'
import { OfflineIndicator } from '@/components/atoms/OfflineIndicator'
import { Settings2, BookOpen } from 'lucide-react-native'
import { hapticMedium } from '@/lib/haptics'
import { TOUCH_TARGET } from '@/lib/shared/design'
import { useToast } from '@/lib/hooks/use-toast'
import { usePreferences } from '@/lib/hooks/use-preferences'
import { useFeedConfig } from '@/lib/hooks/use-feed-config'

export default function HomeFeedScreen() {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<UnifiedTab>('trending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [accumulated, setAccumulated] = useState<NewsArticle[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const debouncedSearch = useDebounce(search, 300)

  const { isBookmarked, toggle } = useBookmarks()
  const { isRead } = useReadingHistory()
  const { showToast } = useToast()
  const { preferences } = usePreferences()
  const { visibleFeeds, feedSort, updateConfig } = useFeedConfig()
  const { visibleTabs } = useVisibleTabs(visibleFeeds)

  // Auto-switch to first tab if current tab was removed from feed
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0])
    }
  }, [visibleTabs, activeTab])

  // Derive bias/factuality from persistent preferences (Settings screen)
  const biasRange = useMemo(
    () => [...PERSPECTIVE_BIASES[preferences.default_perspective]],
    [preferences.default_perspective]
  )
  const minFactuality = preferences.factuality_minimum === 'mixed' ? null : preferences.factuality_minimum

  const toggleWithToast = useCallback(async (id: string) => {
    const wasSaved = isBookmarked(id)
    await toggle(id)
    showToast({
      message: wasSaved ? 'Removed from bookmarks' : 'Story saved',
      variant: wasSaved ? 'info' : 'success',
      onUndo: () => toggle(id, wasSaved ? 'add' : 'remove'),
    })
  }, [toggle, isBookmarked, showToast])

  // Data fetching — topic tabs pass topic filter, feed tabs use feed-specific params
  const isForYou = activeTab === 'for-you'
  const topicFilter = isTopicTab(activeTab) ? activeTab : undefined

  const FEED_SORT_TO_API: Record<FeedSort, 'last_updated' | 'source_count'> = {
    'most-recent': 'last_updated',
    'most-covered': 'source_count',
  }

  const { stories, total, isLoading, isError, mutate } = useStories(
    isForYou ? null : {
      topic: topicFilter,
      search: debouncedSearch,
      blindspot: activeTab === 'blindspot',
      biasRange,
      minFactuality,
      sort: FEED_SORT_TO_API[feedSort],
      page,
    }
  )

  // Accumulate stories and reset on filter changes
  const filterKey = useMemo(
    () => JSON.stringify([activeTab, debouncedSearch, biasRange, minFactuality, feedSort]),
    [activeTab, debouncedSearch, biasRange, minFactuality, feedSort]
  )
  const prevFilterKeyRef = useRef(filterKey)

  useEffect(() => {
    if (isForYou || isLoading) return

    const filtersChanged = filterKey !== prevFilterKeyRef.current
    if (filtersChanged) {
      prevFilterKeyRef.current = filterKey
      setPage(1)
    }

    if (filtersChanged || page === 1) {
      setAccumulated(stories)
    } else {
      setAccumulated(prev => {
        const existingIds = new Set(prev.map(s => s.id))
        const newStories = stories.filter(s => !existingIds.has(s.id))
        return [...prev, ...newStories]
      })
    }
  }, [stories, page, isLoading, filterKey, isForYou])

  const { stories: forYouStories, isLoading: forYouLoading, isAuthenticated } = useForYou()

  const filtered = useMemo(() => {
    if (isForYou) return [...forYouStories]
    return [...accumulated]
  }, [isForYou, accumulated, forYouStories])

  const heroStory = filtered[0] ?? null
  const gridStories = filtered.slice(1)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    setPage(1)
    await mutate()
    hapticMedium()
    setRefreshing(false)
  }, [mutate])

  const onEndReached = useCallback(() => {
    if (total > accumulated.length && !isForYou && !isLoading) {
      setPage(p => p + 1)
    }
  }, [total, accumulated.length, isForYou, isLoading])

  const renderItem = useCallback(({ item }: { item: NewsArticle }) => (
    <View style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
      <NexusCard
        article={item}
        onClick={() => router.push(`/story/${item.id}`)}
        onSave={toggleWithToast}
        isSaved={isBookmarked(item.id)}
        isRead={isRead(item.id)}
        compact
      />
    </View>
  ), [router, toggleWithToast, isBookmarked, isRead])

  const isCurrentlyLoading = isForYou ? forYouLoading : isLoading

  const ListHeader = useMemo(() => (
    <View style={{ gap: 12, paddingBottom: 8 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16 }}>
        <Text testID="axiom-header" style={{ fontFamily: 'DMSerifDisplay', fontSize: 24, color: 'white' }}>
          Axiom
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <OfflineIndicator />
          <Pressable
            testID="guide-button"
            onPress={() => router.push('/guide')}
            hitSlop={TOUCH_TARGET.hitSlop}
            accessibilityLabel="Guide"
            accessibilityRole="button"
            style={{ minWidth: TOUCH_TARGET.min, minHeight: TOUCH_TARGET.min, alignItems: 'center', justifyContent: 'center' }}
          >
            <BookOpen size={20} color="rgba(255, 255, 255, 0.5)" />
          </Pressable>
          <Pressable
            testID="edit-feed-button"
            onPress={() => setShowEditModal(true)}
            hitSlop={TOUCH_TARGET.hitSlop}
            accessibilityLabel="Edit feed"
            accessibilityRole="button"
            style={{ minWidth: TOUCH_TARGET.min, minHeight: TOUCH_TARGET.min, alignItems: 'center', justifyContent: 'center' }}
          >
            <Settings2 size={20} color="rgba(255, 255, 255, 0.5)" />
          </Pressable>
        </View>
      </View>

      {/* Search bar — always visible */}
      <View style={{ paddingHorizontal: 16 }}>
        <SearchBar
          value={search}
          onChange={setSearch}
          onClear={() => setSearch('')}
        />
      </View>

      {/* Unified tab bar */}
      <UnifiedTabBar
        value={activeTab}
        onChange={setActiveTab}
        visibleTabs={visibleTabs}
      />

      {/* For You CTA or Hero card */}
      <View style={{ paddingHorizontal: 16 }}>
        {isForYou && !isAuthenticated ? (
          <ForYouCta onDismiss={() => setActiveTab('trending')} />
        ) : isCurrentlyLoading ? (
          <NexusCardSkeleton />
        ) : heroStory ? (
          <HeroCard
            article={heroStory}
            onClick={() => router.push(`/story/${heroStory.id}`)}
            onSave={toggleWithToast}
            isSaved={isBookmarked(heroStory.id)}
            isRead={isRead(heroStory.id)}
          />
        ) : null}
      </View>
    </View>
  ), [search, activeTab, visibleTabs, filtered.length, isAuthenticated, isCurrentlyLoading, isForYou, heroStory, router, toggleWithToast, isBookmarked, isRead])

  const ListEmpty = useMemo(() => {
    if (filtered.length > 0) return null
    if (isForYou && !isAuthenticated) return null
    if (isCurrentlyLoading) return <NexusCardSkeletonList count={3} />
    if (isError) return <NetworkErrorView onRetry={() => mutate()} />
    return <EmptyStateView icon="search" title="No Matches" message="No stories match your current filters. Try adjusting your search or switching tabs." actionLabel="Clear Search" onAction={() => setSearch('')} />
  }, [filtered.length, isForYou, isAuthenticated, isCurrentlyLoading, isError, mutate])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top']}>
      <FlatList
        data={gridStories}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="rgba(255, 255, 255, 0.5)"
          />
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />

      <EditFeedModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        visibleFeeds={visibleFeeds}
        feedSort={feedSort}
        onUpdateConfig={updateConfig}
      />
    </SafeAreaView>
  )
}
