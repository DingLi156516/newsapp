'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { NewsArticle } from '@/lib/types'
import { ALL_BIASES, PERSPECTIVE_BIASES } from '@/lib/types'
import { useStories } from '@/lib/hooks/use-stories'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useSources } from '@/lib/hooks/use-sources'
import { useFilterParams } from '@/lib/hooks/use-filter-params'
import { buildFeedFilterKey } from '@/lib/hooks/feed-filter-key'
import { NexusCard } from '@/components/organisms/NexusCard'
import { NexusCardSkeleton, NexusCardSkeletonList } from '@/components/organisms/NexusCardSkeleton'
import { SearchBar } from '@/components/organisms/SearchBar'
import { UserMenu } from '@/components/organisms/UserMenu'
import { StatsRow } from '@/components/molecules/StatsRow'
import { HeroCard } from '@/components/organisms/HeroCard'
import { StickyFilterBar } from '@/components/organisms/StickyFilterBar'
import { useBookmarks } from '@/lib/hooks/use-bookmarks'
import { useReadingHistory } from '@/lib/hooks/use-reading-history'
import { usePreferences } from '@/lib/hooks/use-preferences'
import { useForYou } from '@/lib/hooks/use-for-you'
import { ForYouCta } from '@/components/molecules/ForYouCta'
import { SearchFilters } from '@/components/organisms/SearchFilters'
import { OfflineIndicator } from '@/components/atoms/OfflineIndicator'
import { useInfiniteScroll } from '@/lib/hooks/use-infinite-scroll'
import { SearchX, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { ViewSwitcher, type AppView } from '@/components/organisms/ViewSwitcher'
import { SourcesView } from '@/components/organisms/SourcesView'
import { TopicPills } from '@/components/organisms/TopicPills'
import { usePromotedTags } from '@/lib/hooks/use-promoted-tags'

export default function HomePage() {
  return (
    <Suspense>
      <HomePageContent />
    </Suspense>
  )
}

function HomePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeView = (searchParams.get('view') === 'sources' ? 'sources' : 'feed') as AppView

  function handleViewChange(v: AppView) {
    router.push(v === 'sources' ? '/?view=sources' : '/')
  }

  // Filter state persisted in URL search params
  const {
    feedTab, topic, tag, tagType, search, region, biasRange, minFactuality, datePreset,
    setFeedTab, setTopic, setTag, setSearch, setRegion, setBiasRange, setMinFactuality, setDatePreset,
    clearAll,
  } = useFilterParams()

  const { tags: promotedTags, isLoading: promotedTagsLoading } = usePromotedTags()

  // Clear tag selection if the promoted tag disappears (dropped below threshold, etc.)
  useEffect(() => {
    if (!tag || promotedTagsLoading) return
    const stillPromoted = promotedTags.some(
      (t) => t.slug === tag && t.type === tagType
    )
    if (!stillPromoted) setTag(null)
  }, [tag, tagType, promotedTags, promotedTagsLoading, setTag])

  // Pagination state (not in URL — ephemeral)
  const [page, setPage] = useState(1)
  const [accumulated, setAccumulated] = useState<NewsArticle[]>([])

  const debouncedSearch = useDebounce(search, 300)

  const { isBookmarked, toggle, count: savedCount, bookmarkedIds } = useBookmarks()
  const { isRead } = useReadingHistory()
  const { preferences } = usePreferences()

  useEffect(() => {
    if (preferences.default_perspective !== 'all') {
      setBiasRange([...PERSPECTIVE_BIASES[preferences.default_perspective]])
    }
  }, [preferences.default_perspective, setBiasRange])

  const selectedTag = tag ? { slug: tag, type: tagType ?? undefined } : null

  const filterKey = useMemo(
    () => buildFeedFilterKey({
      topic,
      tag,
      tagType,
      region,
      search: debouncedSearch,
      feedTab,
      biasRange,
      minFactuality,
      datePreset,
    }),
    [topic, tag, tagType, region, debouncedSearch, feedTab, biasRange, minFactuality, datePreset]
  )

  // Synchronous reset when filters change mid-pagination. React's documented
  // "reset state when key changes" pattern: the setState call during render
  // discards the current render and re-runs with page=1 — so the SWR request
  // below uses the new page, not the stale one. Without this, switching from
  // Latest page 3 to Trending would first fetch page 3 of trending.
  const [trackedFilterKey, setTrackedFilterKey] = useState(filterKey)
  if (trackedFilterKey !== filterKey) {
    setTrackedFilterKey(filterKey)
    setPage(1)
    setAccumulated([])
  }

  const { stories, total, isLoading } = useStories({
    topic: selectedTag ? undefined : topic,
    tag: selectedTag?.slug,
    tagType: selectedTag?.type,
    region,
    search: debouncedSearch,
    blindspot: feedTab === 'blindspot',
    biasRange,
    minFactuality,
    datePreset,
    sort: feedTab === 'trending' ? 'trending' : undefined,
    page,
  })

  // Accumulator — only grows, never resets (reset happens synchronously above).
  useEffect(() => {
    if (isLoading) return

    if (page === 1) {
      setAccumulated(stories)
    } else {
      setAccumulated(prev => {
        const existingIds = new Set(prev.map(s => s.id))
        const newStories = stories.filter(s => !existingIds.has(s.id))
        return [...prev, ...newStories]
      })
    }
  }, [stories, page, isLoading])

  const { stories: forYouStories, isLoading: forYouLoading, isAuthenticated } = useForYou()

  const { total: totalSources } = useSources()

  // Count blindspot articles for the FeedTabs badge (from accumulated stories)
  const totalBlindspotCount = accumulated.filter((a) => a.isBlindspot).length

  // Client-side filtering for saved/latest tabs
  const filtered = useMemo(() => {
    if (feedTab === 'for-you') {
      return [...forYouStories]
    }

    let articles = [...accumulated]

    if (feedTab === 'saved') {
      articles = articles.filter((a) => bookmarkedIds.has(a.id))
    }

    if (feedTab === 'latest') {
      articles.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    }

    return articles
  }, [feedTab, accumulated, forYouStories, bookmarkedIds])

  // Stats from filtered results
  const blindspotCount = filtered.filter(s => s.isBlindspot).length
  const heroStory = filtered[0] ?? null
  const gridStories = filtered.slice(1)

  const hasMore = total > accumulated.length && feedTab !== 'for-you' && feedTab !== 'saved'
  const handleLoadMore = useCallback(() => setPage(p => p + 1), [])
  const sentinelRef = useInfiniteScroll(handleLoadMore, { enabled: hasMore, isLoading })

  const hasActiveFilters = topic !== null || tag !== null || region !== null || search !== '' ||
    biasRange.length !== ALL_BIASES.length || minFactuality !== null || datePreset !== 'all'

  const showFilters = feedTab !== 'for-you'

  return (
    <div className="min-h-screen mesh-gradient">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl font-bold text-white">Axiom</h1>
            <ViewSwitcher view={activeView} onChange={handleViewChange} />
          </div>
          <div className="flex items-center gap-3">
            <OfflineIndicator />
            <Link
              href="/guide"
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/5 transition-colors"
              aria-label="Guide"
              title="Guide"
            >
              <BookOpen size={16} className="text-white/40 hover:text-white/70" />
            </Link>
            {activeView === 'feed' && showFilters && (
              <SearchBar
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Search stories..."
              />
            )}
            <UserMenu />
          </div>
        </header>

        {activeView === 'feed' && (
          <>
            {/* Advanced search filters — hidden on For You tab */}
            {showFilters && (
              <SearchFilters
                topic={topic}
                onTopicChange={setTopic}
                region={region}
                onRegionChange={setRegion}
                biasRange={biasRange}
                onBiasRangeChange={setBiasRange}
                minFactuality={minFactuality}
                onMinFactualityChange={setMinFactuality}
                datePreset={datePreset}
                onDatePresetChange={setDatePreset}
                hideTopic
                activeTag={tag}
                onClearTag={() => setTag(null)}
                onClearAll={clearAll}
              />
            )}

            {/* Topic + promoted tag pills */}
            {showFilters && (
              <TopicPills
                selected={topic}
                onChange={setTopic}
                promotedTags={promotedTags}
                selectedTag={selectedTag}
                onTagChange={(t) => setTag(t?.slug ?? null, t?.type)}
              />
            )}

            {/* Sticky filter bar */}
            <StickyFilterBar
              feedTab={feedTab}
              onFeedTabChange={setFeedTab}
              savedCount={savedCount}
              blindspotCount={totalBlindspotCount}
            />

            {/* Stats row */}
            <StatsRow
              stories={filtered.length}
              sources={totalSources}
              blindspots={blindspotCount}
              saved={savedCount}
            />

            {/* Dashboard bento feed */}
            <main className="space-y-2">
              {feedTab === 'for-you' && !isAuthenticated ? (
                <ForYouCta onDismiss={() => setFeedTab('trending')} />
              ) : (feedTab === 'for-you' ? forYouLoading : isLoading) ? (
                <>
                  <NexusCardSkeleton />
                  <NexusCardSkeletonList count={4} layout="bento" />
                </>
              ) : filtered.length === 0 ? (
                <div className="glass py-16 flex flex-col items-center gap-4 text-center">
                  <SearchX size={48} className="text-white/20" />
                  <div className="space-y-1">
                    <p className="text-white/70 font-medium">No stories match your filters.</p>
                    <p className="text-sm text-white/40">Try broadening your filters or switching to a different tab</p>
                  </div>
                  {hasActiveFilters && (
                    <button
                      onClick={clearAll}
                      className="glass-pill px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {heroStory && (
                    <HeroCard
                      article={heroStory}
                      onClick={() => router.push(`/story/${heroStory.id}`)}
                      onSave={toggle}
                      isSaved={isBookmarked(heroStory.id)}
                      isRead={isRead(heroStory.id)}
                      showMetrics={feedTab === 'trending'}
                    />
                  )}
                  {gridStories.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {gridStories.map((article) => (
                        <NexusCard
                          key={article.id}
                          article={article}
                          onClick={() => router.push(`/story/${article.id}`)}
                          onSave={toggle}
                          isSaved={isBookmarked(article.id)}
                          isRead={isRead(article.id)}
                          compact
                          showMetrics={feedTab === 'trending'}
                        />
                      ))}
                    </div>
                  )}
                  {hasMore && (
                    <>
                      <div ref={sentinelRef} className="h-1" />
                      {isLoading && <NexusCardSkeletonList count={2} layout="bento" />}
                    </>
                  )}
                </>
              )}
            </main>
          </>
        )}

        {activeView === 'sources' && <SourcesView />}
      </div>
    </div>
  )
}
