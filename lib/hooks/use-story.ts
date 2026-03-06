/**
 * lib/hooks/use-story.ts — SWR hook for a single story detail.
 *
 * Wraps GET /api/stories/[id] with typed response and fallback.
 *
 * --- Conditional fetching ---
 * SWR treats `null` as "do not fetch". Passing `id ? url : null` as the key
 * means: if no ID is available yet, skip the HTTP call entirely. This is SWR's
 * conditional fetching pattern. Java analogy: a guard clause before calling an
 * HttpClient — if (!id) return; — rather than making a request with an empty
 * path segment.
 *
 * --- SWR options used here ---
 * revalidateOnFocus: false  — detail pages don't need background refresh.
 *   Story content is stable and re-fetching on every tab switch would waste
 *   bandwidth with no user benefit.
 *
 * dedupingInterval: 10000   — detail pages are more stable than the feed, so
 *   we dedupe for 10 seconds (vs 5 s for the feed). Multiple renders of the
 *   same story page within 10 s share one network request.
 *
 * --- Fallback strategy ---
 * If the API hasn't responded yet (or isn't running), we look up the story ID
 * in sampleArticles. This means navigating directly to a sample story URL
 * (e.g., /story/1) still shows content without an API call — useful during
 * local development with no backend.
 */

import useSWR from 'swr'
import type { NewsArticle } from '@/lib/types'
import { sampleArticles } from '@/lib/sample-data'
import { fetcher } from '@/lib/hooks/fetcher'

interface StoryApiResponse {
  readonly success: boolean
  readonly data: NewsArticle
}

export function useStory(id: string) {
  const { data, error, isLoading } = useSWR<StoryApiResponse>(
    id ? `/api/stories/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )

  const fallback = sampleArticles.find((a) => a.id === id) ?? null
  const story = data?.data ?? fallback

  return {
    story,
    isLoading,
    isError: !!error,
    error,
  }
}
