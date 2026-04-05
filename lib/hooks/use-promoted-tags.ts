/**
 * lib/hooks/use-promoted-tags.ts — SWR hook for promoted tags.
 *
 * Fetches tags that have crossed the promotion threshold (enough stories
 * to appear as clickable sections in the feed navigation).
 * Uses a long deduping interval since promoted tags change slowly.
 */

import useSWR from 'swr'
import type { StoryTag } from '@/lib/types'
import { fetcher } from '@/lib/hooks/fetcher'

interface PromotedTagsResponse {
  readonly success: boolean
  readonly data: StoryTag[]
}

export function usePromotedTags() {
  const { data, error, isLoading } = useSWR<PromotedTagsResponse>(
    '/api/tags/promoted',
    fetcher,
    { dedupingInterval: 60_000 }
  )

  return {
    tags: data?.data ?? [],
    isLoading,
    isError: !!error,
  }
}
