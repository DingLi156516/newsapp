/**
 * SWR hook for promoted tags — tags with enough stories to appear
 * as clickable sections in the feed navigation.
 */

import useSWR from 'swr'
import type { StoryTag } from '@/lib/shared/types'

interface PromotedTagsResponse {
  readonly success: boolean
  readonly data: StoryTag[]
}

export function usePromotedTags() {
  const { data, error, isLoading } = useSWR<PromotedTagsResponse>(
    '/api/tags/promoted',
    { dedupingInterval: 60_000 }
  )

  return {
    tags: data?.data ?? [],
    isLoading,
    isError: !!error,
  }
}
