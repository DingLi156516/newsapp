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
import { ActiveOwnerChip } from '@/components/molecules/ActiveOwnerChip'
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
    feedTab, topic, tag, tagType, owner, search, region, biasRange, minFactuality, datePreset,
    setFeedTab, setTopic, setTag, setSearch, setRegion, setBiasRange, setMinFactuality, setDatePreset, setOwner,
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
      owner,
      region,
      search: debouncedSearch,
      feedTab,
      biasRange,
      minFactuality,
      datePreset,
    }),
    [topic, tag, tagType, owner, region, debouncedSearch, feedTab, biasRange, minFactuality, datePreset]
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

  const { stories, total, isLoading, ownerFilterUnavailable } = useStories({
    topic: selectedTag ? undefined : topic,
    tag: selectedTag?.slug,
    tagType: selectedTag?.type,
    owner,
    region,
    search: debouncedSearch,
    // When owner filter is active displayFeedTab collapses to 'latest', so the
    // blindspot server filter drops — owner feed wins over blindspot scope.
    blindspot: (owner ? 'latest' : feedTab) === 'blindspot',
    biasRange,
    minFactuality,
    datePreset,
    // When an owner filter is active, suppress sort=trending: the server's
    // trending branch applies a 7-day window that contradicts the 180-day
    // owner-coverage scope. The owner-specific resolver order wins instead.
    // Covers both URL entry (`/?owner=…` with default trending tab) and
    // mid-session tab switches. See Codex review round 8.
    sort: feedTab === 'trending' && !owner ? 'trending' : undefined,
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

  // When an owner filter is active, the server ignores sort=trending and
  // returns owner-recency results (resolver-ordered, 180-day window). The UI
  // must match — otherwise the user sees Trending/Saved/Blindspot chrome on
  // a feed that isn't trending-ranked / bookmark-filtered / blindspot-scoped.
  // displayFeedTab is used *throughout* content selection and display logic
  // so a URL like `/?owner=fox&tab=saved` renders as Latest-with-owner rather
  // than mixing owner-coverage articles through a Saved-tab filter. The URL
  // tab param still persists so clearing the owner restores the original
  // tab. See Codex review rounds 9 P2 and 12 P3.
  const displayFeedTab = owner ? 'latest' : feedTab

  // Client-side filtering for saved/latest tabs. All branches use
  // displayFeedTab — with owner set, only the Latest behavior applies.
  const filtered = useMemo(() => {
    if (displayFeedTab === 'for-you') {
      return [...forYouStories]
    }

    let articles = [...accumulated]

    if (displayFeedTab === 'saved') {
      articles = articles.filter((a) => bookmarkedIds.has(a.id))
    }

    // When an owner filter is active the server has already ordered the page
    // by resolver position (per-owner article recency). Client-side re-sort
    // by `timestamp` (which maps to `published_at`) would bury older ongoing
    // stories with fresh owner coverage — the very case the server-side
    // order was designed to surface. See Codex round-6 finding #2.
    if (displayFeedTab === 'latest' && !owner) {
      articles.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    }

    return articles
  }, [displayFeedTab, owner, accumulated, forYouStories, bookmarkedIds])

  // Stats from filtered results
  const blindspotCount = filtered.filter(s => s.isBlindspot).length
  const heroStory = filtered[0] ?? null
  const gridStories = filtered.slice(1)

  const hasMore = total > accumulated.length && displayFeedTab !== 'for-you' && displayFeedTab !== 'saved'
  const handleLoadMore = useCallback(() => setPage(p => p + 1), [])
  const sentinelRef = useInfiniteScroll(handleLoadMore, { enabled: hasMore, isLoading })

  const hasActiveFilters = topic !== null || tag !== null || owner !== null || region !== null || search !== '' ||
    biasRange.length !== ALL_BIASES.length || minFactuality !== null || datePreset !== 'all'

  const showFilters = displayFeedTab !== 'for-you'

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
                activeOwner={owner}
                onClearTag={() => setTag(null)}
                onClearAll={clearAll}
              />
            )}

            {/* Active owner filter chip — visible when ?owner=… is set */}
            {showFilters && owner && (
              <ActiveOwnerChip slug={owner} onClear={() => setOwner(null)} />
            )}

            {/*
              Owner-lookup outage banner — surfaces independently of whether
              the user has already accumulated stories from earlier pages.
              Without this, a mid-scroll owner-lookup failure would silently
              collapse `hasMore` to false and the empty-state copy would never
              render (filtered.length > 0 on later pages). See Codex round-7
              finding #1.
            */}
            {showFilters && owner && ownerFilterUnavailable && filtered.length > 0 && (
              <div
                data-testid="owner-filter-unavailable-banner"
                role="status"
                className="glass-sm flex items-center gap-3 px-4 py-2.5 text-xs text-white/70"
              >
                <span className="h-2 w-2 rounded-full bg-amber-400/80 flex-shrink-0" />
                <span className="flex-1">
                  Owner filter hit a temporary lookup error — some recent coverage may be
                  missing. Try again in a minute or clear the filter.
                </span>
                <button
                  onClick={() => setOwner(null)}
                  className="glass-pill px-3 py-1 text-[11px] text-white/80 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>
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

            {/* Sticky filter bar — tab switches clear the owner filter so
                content, tab highlight, and URL state stay coherent. Both
                changes must land in a single router.push: calling setOwner
                then setFeedTab back-to-back would derive both URLs from the
                same stale searchParams snapshot and the second push would
                restore ?owner=…. See round-10 P1 + round-11 P1. */}
            <StickyFilterBar
              feedTab={displayFeedTab}
              onFeedTabChange={(tab) => {
                // Re-clicking the already-active tab is a no-op — don't
                // silently drop the owner filter just because the user
                // tapped the tab that's already selected. See round-12 P2.
                if (tab === displayFeedTab) return
                if (owner) {
                  const params = new URLSearchParams(searchParams.toString())
                  params.delete('owner')
                  if (tab === 'trending') params.delete('tab')
                  else params.set('tab', tab)
                  const str = params.toString()
                  router.push(str ? `/?${str}` : '/')
                } else {
                  setFeedTab(tab)
                }
              }}
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
              {displayFeedTab === 'for-you' && !isAuthenticated ? (
                <ForYouCta onDismiss={() => setFeedTab('trending')} />
              ) : (displayFeedTab === 'for-you' ? forYouLoading : isLoading) ? (
                <>
                  <NexusCardSkeleton />
                  <NexusCardSkeletonList count={4} layout="bento" />
                </>
              ) : filtered.length === 0 ? (
                <div
                  className="glass py-16 flex flex-col items-center gap-4 text-center"
                  data-testid={ownerFilterUnavailable ? 'owner-filter-unavailable' : 'empty-feed'}
                >
                  <SearchX size={48} className="text-white/20" />
                  <div className="space-y-1">
                    {ownerFilterUnavailable ? (
                      <>
                        <p className="text-white/70 font-medium">
                          Owner filter temporarily unavailable.
                        </p>
                        <p className="text-sm text-white/40">
                          We couldn&apos;t look up this publisher&apos;s recent coverage. Try again
                          in a minute, or clear the filter to see the full feed.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-white/70 font-medium">No stories match your filters.</p>
                        <p className="text-sm text-white/40">Try broadening your filters or switching to a different tab</p>
                      </>
                    )}
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
                      showMetrics={displayFeedTab === 'trending'}
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
                          showMetrics={displayFeedTab === 'trending'}
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
