/**
 * Home Feed screen — Unified tab bar with feeds, topics, and promoted tags.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import { View, FlatList, RefreshControl } from 'react-native'
import Animated from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import type { NewsArticle, UnifiedTab, FeedSort, SelectedPromotedTag } from '@/lib/shared/types'
import { PERSPECTIVE_BIASES, isTopicTab } from '@/lib/shared/types'
import { useStories } from '@/lib/hooks/use-stories'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useBookmarks } from '@/lib/hooks/use-bookmarks'
import { useReadingHistory } from '@/lib/hooks/use-reading-history'
import { useForYou } from '@/lib/hooks/use-for-you'
import { useVisibleTabs } from '@/lib/hooks/use-visible-tabs'
import { usePromotedTags } from '@/lib/hooks/use-promoted-tags'
import { NexusCard } from '@/components/organisms/NexusCard'
import { SwipeableCard } from '@/components/molecules/SwipeableCard'
import { NexusCardSkeleton, NexusCardSkeletonList } from '@/components/organisms/NexusCardSkeleton'
import { EditorialHeroCard } from '@/components/organisms/EditorialHeroCard'
import { UnifiedTabBar } from '@/components/organisms/UnifiedTabBar'
import { EditFeedModal } from '@/components/organisms/EditFeedModal'
import { SearchBar } from '@/components/organisms/SearchBar'
import { EmptyStateView } from '@/components/molecules/EmptyStateView'
import { NetworkErrorView } from '@/components/molecules/NetworkErrorView'
import { ForYouCta } from '@/components/molecules/ForYouCta'
import { PullToRefreshIndicator } from '@/components/molecules/PullToRefreshIndicator'
import { OfflineIndicator } from '@/components/atoms/OfflineIndicator'
import { Settings2, BookOpen } from 'lucide-react-native'
import { hapticMedium } from '@/lib/haptics'
import { useToast } from '@/lib/hooks/use-toast'
import { usePreferences } from '@/lib/hooks/use-preferences'
import { useFeedConfig } from '@/lib/hooks/use-feed-config'
import { useTheme } from '@/lib/shared/theme'
import { ScreenHeader, IconButton, ENTRY_PRESETS, SPACING } from '@/lib/ui'

export default function HomeFeedScreen() {
  const router = useRouter()
  const theme = useTheme()
  const params = useLocalSearchParams<{ tag?: string; tag_type?: string }>()

  const [activeTab, setActiveTab] = useState<UnifiedTab>('trending')
  const [selectedPromotedTag, setSelectedPromotedTag] = useState<SelectedPromotedTag | null>(null)
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
  const { visibleFeeds, feedSort, hiddenPromotedTags, updateConfig } = useFeedConfig()
  const { visibleTabs } = useVisibleTabs(visibleFeeds)
  const { tags: allPromotedTags, isLoading: promotedTagsLoading } = usePromotedTags()

  // Filter out hidden promoted tags (keyed by slug:type for disambiguation)
  const promotedTags = useMemo(() => {
    const hiddenSet = new Set(hiddenPromotedTags)
    return allPromotedTags.filter((t) => !hiddenSet.has(`${t.slug}:${t.type}`))
  }, [allPromotedTags, hiddenPromotedTags])

  // Hydrate promoted tag selection from navigation params (e.g., from story detail)
  useEffect(() => {
    if (params.tag) {
      setSelectedPromotedTag({ slug: params.tag, type: params.tag_type })
    }
  }, [params.tag, params.tag_type])

  // Auto-switch to first tab if current tab was removed from feed
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0])
    }
  }, [visibleTabs, activeTab])

  // Clear promoted tag selection if the active tag is no longer visible
  // (hidden by user in EditFeedModal, dropped below threshold, or all tags gone)
  useEffect(() => {
    if (!selectedPromotedTag || promotedTagsLoading) return
    const stillVisible = promotedTags.some((t) => t.slug === selectedPromotedTag.slug && t.type === selectedPromotedTag.type)
    if (!stillVisible) setSelectedPromotedTag(null)
  }, [selectedPromotedTag, promotedTags, promotedTagsLoading])

  // Clear promoted tag selection when switching to a feed/topic tab
  const handleTabChange = useCallback((tab: UnifiedTab) => {
    setActiveTab(tab)
    setSelectedPromotedTag(null)
  }, [])

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

  // Trending tab ignores the sort preference — it uses the trending algorithm.
  const isTrending = activeTab === 'trending'
  const apiSort: 'last_updated' | 'source_count' | 'trending' =
    isTrending ? 'trending' : FEED_SORT_TO_API[feedSort]

  const filterKey = useMemo(
    () => JSON.stringify([activeTab, selectedPromotedTag, debouncedSearch, biasRange, minFactuality, feedSort]),
    [activeTab, selectedPromotedTag, debouncedSearch, biasRange, minFactuality, feedSort]
  )

  // Synchronous reset on filter change (React "reset state when key changes"
  // pattern). Without this, switching from a scrolled Most-Covered feed to
  // Trending first fetches `sort=trending&page=N` with the stale page before
  // the effect catches up.
  const [trackedFilterKey, setTrackedFilterKey] = useState(filterKey)
  if (trackedFilterKey !== filterKey) {
    setTrackedFilterKey(filterKey)
    setPage(1)
    setAccumulated([])
  }

  const { stories, total, isLoading, isError, mutate } = useStories(
    isForYou ? null : {
      topic: selectedPromotedTag ? undefined : topicFilter,
      tag: selectedPromotedTag?.slug,
      tagType: selectedPromotedTag?.type,
      search: debouncedSearch,
      blindspot: activeTab === 'blindspot',
      biasRange,
      minFactuality,
      sort: apiSort,
      page,
    }
  )

  // Accumulator — only grows; reset happens synchronously above.
  useEffect(() => {
    if (isForYou || isLoading) return

    if (page === 1) {
      setAccumulated(stories)
    } else {
      setAccumulated(prev => {
        const existingIds = new Set(prev.map(s => s.id))
        const newStories = stories.filter(s => !existingIds.has(s.id))
        return [...prev, ...newStories]
      })
    }
  }, [stories, page, isLoading, isForYou])

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

  const renderItem = useCallback(({ item, index }: { item: NewsArticle; index: number }) => (
    <Animated.View
      entering={ENTRY_PRESETS.staggered(index)}
      style={{ paddingHorizontal: SPACING.lg, paddingVertical: 6 }}
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
          showMetrics={isTrending}
        />
      </SwipeableCard>
    </Animated.View>
  ), [router, toggleWithToast, isBookmarked, isRead, isTrending])

  const isCurrentlyLoading = isForYou ? forYouLoading : isLoading

  const ListHeader = useMemo(() => (
    <View style={{ gap: 12, paddingBottom: 8 }}>
      {/* Custom pull-to-refresh indicator */}
      {refreshing && <PullToRefreshIndicator progress={1} refreshing={refreshing} />}

      <ScreenHeader
        title="Axiom"
        titleTestID="axiom-header"
        leading={<OfflineIndicator />}
        trailing={[
          <IconButton
            key="guide"
            testID="guide-button"
            icon={BookOpen}
            tone="tertiary"
            onPress={() => router.push('/guide')}
            accessibilityLabel="Guide"
          />,
          <IconButton
            key="edit-feed"
            testID="edit-feed-button"
            icon={Settings2}
            tone="tertiary"
            onPress={() => setShowEditModal(true)}
            accessibilityLabel="Edit feed"
          />,
        ]}
      />

      {/* Search bar — always visible */}
      <View style={{ paddingHorizontal: 16 }}>
        <SearchBar
          value={search}
          onChange={setSearch}
          onClear={() => setSearch('')}
        />
      </View>

      {/* Unified tab bar with promoted tags */}
      <UnifiedTabBar
        value={activeTab}
        onChange={handleTabChange}
        visibleTabs={visibleTabs}
        promotedTags={promotedTags}
        selectedPromotedTag={selectedPromotedTag}
        onPromotedTagChange={setSelectedPromotedTag}
      />

      {/* For You CTA or editorial hero */}
      <View style={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xs }}>
        {isForYou && !isAuthenticated ? (
          <ForYouCta onDismiss={() => setActiveTab('trending')} />
        ) : isCurrentlyLoading ? (
          <NexusCardSkeleton />
        ) : heroStory ? (
          <Animated.View entering={ENTRY_PRESETS.heroFade}>
            <EditorialHeroCard
              article={heroStory}
              onClick={() => router.push(`/story/${heroStory.id}`)}
              onSave={toggleWithToast}
              isSaved={isBookmarked(heroStory.id)}
              isRead={isRead(heroStory.id)}
              showMetrics={isTrending}
            />
          </Animated.View>
        ) : null}
      </View>
    </View>
  ), [search, activeTab, visibleTabs, promotedTags, selectedPromotedTag, filtered.length, isAuthenticated, isCurrentlyLoading, isForYou, heroStory, router, toggleWithToast, isBookmarked, isRead, handleTabChange, refreshing, isTrending])

  const ListEmpty = useMemo(() => {
    if (filtered.length > 0) return null
    if (isForYou && !isAuthenticated) return null
    if (isCurrentlyLoading) return <NexusCardSkeletonList count={3} />
    if (isError) return <NetworkErrorView onRetry={() => mutate()} />
    return <EmptyStateView icon="search" title="No Matches" message="No stories match your current filters. Try adjusting your search or switching tabs." actionLabel="Clear Search" onAction={() => setSearch('')} />
  }, [filtered.length, isForYou, isAuthenticated, isCurrentlyLoading, isError, mutate])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.background }} edges={['top']}>
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
            tintColor={theme.text.tertiary}
            colors={[theme.text.tertiary]}
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
        hiddenPromotedTags={hiddenPromotedTags}
        promotedTags={allPromotedTags}
        onUpdateConfig={updateConfig}
      />
    </SafeAreaView>
  )
}
