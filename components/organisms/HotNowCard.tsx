/**
 * components/organisms/HotNowCard.tsx — "Hot Now" dashboard card.
 *
 * Renders the top 5 stories by recent unique-viewer count. Empty-state
 * copy when engagement data is still cold (a fresh deploy / quiet hour
 * lands here for a few minutes before traffic warms it up).
 */
'use client'

import { useRouter } from 'next/navigation'
import { Flame } from 'lucide-react'
import { useHotStories } from '@/lib/hooks/use-hot-stories'
import { useBookmarks } from '@/lib/hooks/use-bookmarks'
import { NexusCard } from '@/components/organisms/NexusCard'
import { NexusCardSkeletonList } from '@/components/organisms/NexusCardSkeleton'

export function HotNowCard() {
  const router = useRouter()
  const { hotStories, isLoading, isError } = useHotStories()
  const { isBookmarked, toggle } = useBookmarks()

  return (
    <section data-testid="hot-now-section" className="space-y-3">
      <header className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 border border-white/10">
          <Flame size={14} className="text-orange-300/90" />
        </span>
        <h2
          className="text-lg font-semibold text-white"
          style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
        >
          Hot Now
        </h2>
        <span className="text-xs text-white/40 ml-1">last 6h</span>
      </header>

      {isLoading ? (
        <NexusCardSkeletonList count={3} layout="bento" />
      ) : isError ? (
        <div className="glass flex items-center justify-center py-8 text-sm text-white/60">
          Couldn&apos;t load hot stories — try again in a moment.
        </div>
      ) : hotStories.length === 0 ? (
        <div className="glass flex items-center justify-center py-12 text-sm text-white/60 text-center px-4">
          No engagement data yet. Hot Now fills in as readers start opening stories.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {hotStories.map((article) => (
            <NexusCard
              key={article.id}
              article={article}
              isSaved={isBookmarked(article.id)}
              onSave={toggle}
              onClick={() => router.push(`/story/${article.id}`)}
              compact
            />
          ))}
        </div>
      )}
    </section>
  )
}
