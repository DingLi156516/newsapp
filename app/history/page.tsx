/**
 * app/history/page.tsx — Reading history page.
 *
 * Shows a grid of previously read stories, fetched from the reading_history table.
 * Requires authentication — redirects to /login if not signed in.
 */
'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock } from 'lucide-react'
import { useStories } from '@/lib/hooks/use-stories'
import { useReadingHistory } from '@/lib/hooks/use-reading-history'
import { useRequireAuth } from '@/lib/hooks/use-require-auth'
import { useBookmarks } from '@/lib/hooks/use-bookmarks'
import { NexusCard } from '@/components/organisms/NexusCard'
import { NexusCardSkeletonList } from '@/components/organisms/NexusCardSkeleton'
import { UserMenu } from '@/components/organisms/UserMenu'

export default function HistoryPage() {
  const router = useRouter()
  useRequireAuth()

  const { stories, isLoading: storiesLoading } = useStories()
  const { isRead } = useReadingHistory()
  const { isBookmarked, toggle } = useBookmarks()

  const readStories = useMemo(
    () => stories.filter((story) => isRead(story.id)),
    [stories, isRead]
  )

  const isLoading = storiesLoading

  return (
    <div className="min-h-screen mesh-gradient">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Header */}
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

        {/* Banner */}
        <div className="glass p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 border border-white/10">
              <Clock size={16} className="text-white/80" />
            </div>
            <h1
              className="text-xl font-bold text-white"
              style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
            >
              Reading History
            </h1>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            Stories you&apos;ve previously read. Your reading history helps build your
            bias calibration profile.
          </p>
          <div className="flex items-center gap-3 text-xs text-white/60">
            <span>
              {readStories.length} {readStories.length === 1 ? 'story' : 'stories'} read
            </span>
          </div>
        </div>

        {/* Story grid */}
        {isLoading ? (
          <NexusCardSkeletonList count={4} />
        ) : readStories.length === 0 ? (
          <div className="glass flex items-center justify-center py-16 text-white/60 text-sm">
            No stories read yet — start exploring the feed!
          </div>
        ) : (
          <div className="grid gap-4">
            {readStories.map((article) => (
              <NexusCard
                key={article.id}
                article={article}
                isSaved={isBookmarked(article.id)}
                onSave={toggle}
                onClick={() => router.push(`/story/${article.id}`)}
                isRead
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
