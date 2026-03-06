'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BiasCategory, DatePreset, FactualityLevel, FeedTab, NewsArticle, Topic } from '@/lib/types'
import { ALL_BIASES, PERSPECTIVE_BIASES } from '@/lib/types'
import { useStories } from '@/lib/hooks/use-stories'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useSources } from '@/lib/hooks/use-sources'
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

export default function HomePage() {
  return <HomePageContent />
}

function HomePageContent() {
  const router = useRouter()

  const [feedTab, setFeedTab] = useState<FeedTab>('trending')
  const [topic, setTopic] = useState<Topic | null>(null)
  const [search, setSearch] = useState('')
  const [biasRange, setBiasRange] = useState<BiasCategory[]>(ALL_BIASES)
  const [minFactuality, setMinFactuality] = useState<FactualityLevel | null>(null)
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
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
  }, [preferences.default_perspective])

  const { stories, total, isLoading } = useStories({
    topic,
    search: debouncedSearch,
    blindspot: feedTab === 'blindspot',
    biasRange,
    minFactuality,
    datePreset,
    page,
  })

  // Accumulate stories across pages, deduping by id
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

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1)
    setAccumulated([])
  }, [topic, debouncedSearch, feedTab === 'blindspot', biasRange, minFactuality, datePreset])

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

  return (
    <div className="min-h-screen mesh-gradient">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h1 className="font-serif text-2xl font-bold text-white">Axiom</h1>
            <span className="text-xs text-white/30 hidden sm:inline">See the Full Spectrum</span>
          </div>
          <div className="flex items-center gap-3">
            <SearchBar
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              placeholder="Search stories..."
            />
            <UserMenu />
          </div>
        </header>

        {/* Advanced search filters */}
        <SearchFilters
          topic={topic}
          onTopicChange={setTopic}
          biasRange={biasRange}
          onBiasRangeChange={setBiasRange}
          minFactuality={minFactuality}
          onMinFactualityChange={setMinFactuality}
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
        />

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
            <div className="glass py-16 text-center">
              <p className="text-white/50">No stories match your filters.</p>
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
                    />
                  ))}
                </div>
              )}
              {total > accumulated.length && feedTab !== 'for-you' && feedTab !== 'saved' && (
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={isLoading}
                  className="glass-pill mx-auto block px-6 py-2 text-sm text-white/70 hover:text-white transition-colors"
                >
                  {isLoading ? 'Loading...' : 'Load more'}
                </button>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
