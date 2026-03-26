/**
 * SWR hook for a single story detail.
 * Adapted from web — uses AsyncStorage cache instead of Cache API.
 */

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import type { NewsArticle } from '@/lib/shared/types'
import { getCachedStory } from '@/lib/offline/cache-manager'

interface StoryApiResponse {
  readonly success: boolean
  readonly data: NewsArticle
}

export function useStory(id: string) {
  const { data, error, isLoading } = useSWR<StoryApiResponse>(
    id ? `/api/stories/${id}` : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )

  const [cachedStory, setCachedStory] = useState<NewsArticle | null>(null)

  useEffect(() => {
    if (error && !data) {
      getCachedStory(id).then((cached) => {
        if (cached) {
          setCachedStory(cached)
        }
      })
    }
  }, [error, data, id])

  const story = data?.data ?? cachedStory ?? null

  return {
    story,
    isLoading,
    isError: !!error && !cachedStory,
    error,
  }
}
