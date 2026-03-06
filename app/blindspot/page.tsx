/**
 * app/blindspot/page.tsx — Dedicated "Blindspot" feed page (route: "/blindspot").
 *
 * This page is a focused view showing only articles flagged as blindspots
 * (isBlindspot === true), with an explanatory banner at the top.
 *
 * The `blindspotArticles` array is computed once at module load time (outside the
 * component function). This is safe because the source data is static — it won't
 * change between renders. If the data were dynamic (fetched from an API), you'd
 * move this into a `useMemo` or server-side fetch instead.
 *
 * Bookmark state is local to this page, same limitation as the story detail page:
 * bookmarks don't sync with the main feed. A global state solution would fix this.
 *
 * The page is accessible via:
 *   - Direct URL navigation to /blindspot
 *   - The "Blindspot" tab on the main feed (which actually filters in-place;
 *     this route is a full standalone page for the feature)
 */
'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Eye } from 'lucide-react'
import { useStories } from '@/lib/hooks/use-stories'
import { NexusCard } from '@/components/organisms/NexusCard'
import { NexusCardSkeletonList } from '@/components/organisms/NexusCardSkeleton'
import { UserMenu } from '@/components/organisms/UserMenu'
import { useBookmarks } from '@/lib/hooks/use-bookmarks'

export default function BlindspotPage() {
  const router = useRouter()
  const { isBookmarked, toggle } = useBookmarks()

  const { stories: blindspotArticles, isLoading } = useStories({ blindspot: true })

  return (
    <div className="min-h-screen mesh-gradient">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Back navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Feed
          </button>
          <UserMenu />
        </div>

        {/* Explanatory banner — explains what "Blindspot" means to the user */}
        <div className="glass p-5 space-y-3">
          <div className="flex items-center gap-2">
            {/* The Eye icon and spectrum-far-left class signal "uneven perspective" visually */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full spectrum-far-left border border-white/10">
              <Eye size={16} className="text-white/80" />
            </div>
            <h1
              className="text-xl font-bold text-white"
              style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
            >
              Blindspot Feed
            </h1>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            These stories have a coverage skew greater than 80% from one side of the political
            spectrum. One perspective is dominating the narrative — the other is largely silent.
          </p>
          {/* Dynamic count with correct singular/plural — ternary shorthand */}
          <div className="flex items-center gap-3 text-xs text-white/60">
            <span>{blindspotArticles.length} blindspot {blindspotArticles.length === 1 ? 'story' : 'stories'} detected</span>
            <span>·</span>
            <span>Updated continuously</span>
          </div>
        </div>

        {/* Feed: loading, empty state, or article grid */}
        {isLoading ? (
          <NexusCardSkeletonList count={3} />
        ) : blindspotArticles.length === 0 ? (
          <div className="glass flex items-center justify-center py-16 text-white/60 text-sm">
            No blindspot stories detected right now
          </div>
        ) : (
          <div className="grid gap-4">
            {blindspotArticles.map((article) => (
              <NexusCard
                key={article.id}
                article={article}
                isSaved={isBookmarked(article.id)}
                onSave={toggle}
                onClick={() => router.push(`/story/${article.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
