/**
 * components/organisms/SuggestionsList.tsx — Suggested stories grid.
 *
 * Displays a grid of NexusCards for stories from underrepresented bias categories.
 */
'use client'

import { useRouter } from 'next/navigation'
import type { NewsArticle } from '@/lib/types'
import { NexusCard } from '@/components/organisms/NexusCard'
import { NexusCardSkeletonList } from '@/components/organisms/NexusCardSkeleton'
import { useBookmarks } from '@/lib/hooks/use-bookmarks'

interface Props {
  readonly suggestions: readonly NewsArticle[]
  readonly isLoading: boolean
}

export function SuggestionsList({ suggestions, isLoading }: Props) {
  const router = useRouter()
  const { isBookmarked, toggle } = useBookmarks()

  if (isLoading) {
    return <NexusCardSkeletonList count={3} layout="bento" />
  }

  if (suggestions.length === 0) {
    return (
      <div className="glass flex items-center justify-center py-12 text-white/60 text-sm">
        Read more stories to get personalized suggestions!
      </div>
    )
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {suggestions.map((article) => (
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
  )
}
