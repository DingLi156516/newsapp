/**
 * Blindspot tab — Dedicated feed of stories under-covered on one side of
 * the political spectrum. Reuses the blindspot filter on the stories API.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, FlatList, RefreshControl } from 'react-native'
import Animated from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Eye } from 'lucide-react-native'
import type { NewsArticle, BiasCategory, Topic } from '@/lib/shared/types'
import { TOPIC_LABELS, BIAS_LABELS } from '@/lib/shared/types'
import { useStories } from '@/lib/hooks/use-stories'
import { useBookmarks } from '@/lib/hooks/use-bookmarks'
import { useReadingHistory } from '@/lib/hooks/use-reading-history'
import { useToast } from '@/lib/hooks/use-toast'
import { NexusCard, type FooterBand } from '@/components/organisms/NexusCard'
import { SwipeableCard } from '@/components/molecules/SwipeableCard'
import { NexusCardSkeletonList } from '@/components/organisms/NexusCardSkeleton'
import { EmptyStateView } from '@/components/molecules/EmptyStateView'
import { NetworkErrorView } from '@/components/molecules/NetworkErrorView'
import { PullToRefreshIndicator } from '@/components/molecules/PullToRefreshIndicator'
import { hapticMedium } from '@/lib/haptics'
import { useTheme } from '@/lib/shared/theme'
import { ScreenHeader } from '@/lib/ui/composed/ScreenHeader'
import { Pill } from '@/lib/ui/primitives/Pill'
import { Divider } from '@/lib/ui/primitives/Divider'
import { SPACING, ENTRY_PRESETS } from '@/lib/ui/tokens'

type BlindspotSkew = 'all' | 'right-skew' | 'left-skew'

interface FilterPill {
  readonly id: BlindspotSkew | Topic
  readonly label: string
}

// Visually split into two taxonomies: skew (all/right-skew/left-skew) and
// topic (politics/technology). They share one filter state — selecting any
// pill clears the others — but the divider signals independent dimensions.
const SKEW_PILLS: readonly FilterPill[] = [
  { id: 'all', label: 'All' },
  { id: 'right-skew', label: 'Right-skew' },
  { id: 'left-skew', label: 'Left-skew' },
]

const TOPIC_PILLS: readonly FilterPill[] = [
  { id: 'politics', label: 'Politics' },
  { id: 'technology', label: 'Tech' },
]

const ALL_FILTERS: readonly FilterPill[] = [...SKEW_PILLS, ...TOPIC_PILLS]

const LEFT_BIASES: readonly BiasCategory[] = ['far-left', 'left', 'lean-left']
const RIGHT_BIASES: readonly BiasCategory[] = ['lean-right', 'right', 'far-right']

function computeSkew(article: NewsArticle): 'left' | 'right' | 'center' {
  let left = 0
  let right = 0
  for (const seg of article.spectrumSegments) {
    if (LEFT_BIASES.includes(seg.bias)) left += seg.percentage
    else if (RIGHT_BIASES.includes(seg.bias)) right += seg.percentage
  }
  if (left > right + 10) return 'left'
  if (right > left + 10) return 'right'
  return 'center'
}

function skewFooterBand(article: NewsArticle): FooterBand {
  const skew = computeSkew(article)
  if (skew === 'left') {
    return { label: 'Under-covered by right-leaning outlets', tone: 'info' }
  }
  if (skew === 'right') {
    return { label: 'Under-covered by left-leaning outlets', tone: 'warning' }
  }
  return { label: 'Sparse coverage across the spectrum', tone: 'info' }
}

export default function BlindspotTabScreen() {
  const router = useRouter()
  const theme = useTheme()
  const [filter, setFilter] = useState<BlindspotSkew | Topic>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [accumulated, setAccumulated] = useState<NewsArticle[]>([])
  const { isBookmarked, toggle } = useBookmarks()
  const { isRead } = useReadingHistory()
  const { showToast } = useToast()

  const topicFilter: Topic | undefined = useMemo(() => {
    if (filter === 'politics' || filter === 'technology') return filter
    return undefined
  }, [filter])

  // Reset pagination synchronously when filter changes (React `reset state
  // when key changes` pattern — same as home-feed).
  const filterKey = useMemo(() => JSON.stringify([filter, topicFilter]), [filter, topicFilter])
  const [trackedFilterKey, setTrackedFilterKey] = useState(filterKey)
  if (trackedFilterKey !== filterKey) {
    setTrackedFilterKey(filterKey)
    setPage(1)
    setAccumulated([])
  }

  const { stories, total, isLoading, isError, mutate } = useStories({
    blindspot: true,
    topic: topicFilter,
    sort: 'last_updated',
    page,
  })

  // Accumulator — append new pages without duplicates.
  useEffect(() => {
    if (isLoading) return
    if (page === 1) {
      setAccumulated(stories)
    } else {
      setAccumulated((prev) => {
        const existingIds = new Set(prev.map((s) => s.id))
        const newStories = stories.filter((s) => !existingIds.has(s.id))
        return [...prev, ...newStories]
      })
    }
  }, [stories, page, isLoading])

  const isSkewFilter = filter === 'right-skew' || filter === 'left-skew'
  const hasMorePages = total > accumulated.length

  const filtered = useMemo(() => {
    if (filter === 'right-skew') {
      return accumulated.filter((s) => computeSkew(s) === 'right')
    }
    if (filter === 'left-skew') {
      return accumulated.filter((s) => computeSkew(s) === 'left')
    }
    return accumulated
  }, [accumulated, filter])

  // Skew filters run client-side. If the current page yields too few matches,
  // keep fetching until we hit a visible floor or run out of pages — otherwise
  // an empty early page would show "No blindspots" while matches exist later.
  const MIN_SKEW_MATCHES = 5
  useEffect(() => {
    if (!isSkewFilter) return
    if (isLoading) return
    if (!hasMorePages) return
    if (filtered.length >= MIN_SKEW_MATCHES) return
    setPage((p) => p + 1)
  }, [isSkewFilter, isLoading, hasMorePages, filtered.length])

  const onEndReached = useCallback(() => {
    if (isLoading) return
    if (hasMorePages) {
      setPage((p) => p + 1)
    }
  }, [isLoading, hasMorePages])

  const toggleWithToast = useCallback(async (id: string) => {
    const wasSaved = isBookmarked(id)
    await toggle(id)
    showToast({
      message: wasSaved ? 'Removed from bookmarks' : 'Story saved',
      variant: wasSaved ? 'info' : 'success',
      onUndo: () => toggle(id, wasSaved ? 'add' : 'remove'),
    })
  }, [toggle, isBookmarked, showToast])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    setPage(1)
    await mutate()
    hapticMedium()
    setRefreshing(false)
  }, [mutate])

  const renderItem = useCallback(({ item, index }: { item: NewsArticle; index: number }) => (
    <Animated.View
      entering={ENTRY_PRESETS.staggered(index)}
      style={{ paddingHorizontal: 16, paddingVertical: 6 }}
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
          footerBand={skewFooterBand(item)}
        />
      </SwipeableCard>
    </Animated.View>
  ), [router, toggleWithToast, isBookmarked, isRead])

  const ListHeader = useMemo(() => (
    <View style={{ gap: SPACING.sm, paddingBottom: SPACING.sm }}>
      {refreshing && <PullToRefreshIndicator progress={1} refreshing={refreshing} />}

      <ScreenHeader
        title="Blindspot"
        subtitle="Stories under-covered on one side of the political spectrum."
        leading={<Eye size={22} color={theme.text.primary} />}
        titleTestID="blindspot-header"
      />

      <View
        style={{
          flexDirection: 'row',
          gap: SPACING.xs,
          paddingHorizontal: SPACING.lg,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {SKEW_PILLS.map((pill) => (
          <Pill
            key={pill.id}
            label={pill.label}
            active={filter === pill.id}
            onPress={() => setFilter(pill.id)}
            testID={`blindspot-filter-${pill.id}`}
          />
        ))}
        <Divider
          orientation="vertical"
          style={{ height: 20, marginHorizontal: SPACING.xs / 2 }}
        />
        {TOPIC_PILLS.map((pill) => (
          <Pill
            key={pill.id}
            label={pill.label}
            active={filter === pill.id}
            onPress={() => setFilter(pill.id)}
            testID={`blindspot-filter-${pill.id}`}
          />
        ))}
      </View>
    </View>
  ), [refreshing, filter, theme.text.primary])

  const ListEmpty = useMemo(() => {
    if (filtered.length > 0) return null
    if (isLoading) return <NexusCardSkeletonList count={3} />
    if (isError) return <NetworkErrorView onRetry={() => mutate()} />
    // Skew filters are applied client-side, so an empty result on an early
    // page doesn't mean the filter is truly empty — more pages may contain
    // matches. Keep showing a skeleton while pagination is still fetching.
    if (isSkewFilter && hasMorePages) return <NexusCardSkeletonList count={3} />
    const activeLabel = ALL_FILTERS.find((p) => p.id === filter)?.label ?? ''
    return (
      <EmptyStateView
        icon="search"
        title="No Blindspots"
        message={
          filter === 'all'
            ? 'No blindspot stories right now. Check back later.'
            : `No ${activeLabel} blindspots right now. Try another filter.`
        }
        actionLabel={filter === 'all' ? undefined : 'Clear Filter'}
        onAction={filter === 'all' ? undefined : () => setFilter('all')}
      />
    )
  }, [filtered.length, isLoading, isError, isSkewFilter, hasMorePages, filter, mutate])

  // Suppress unused-variable lint for label lookup helper.
  void BIAS_LABELS
  void TOPIC_LABELS

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.background }} edges={['top']}>
      <FlatList
        data={filtered}
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
    </SafeAreaView>
  )
}
