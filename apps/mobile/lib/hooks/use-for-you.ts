/**
 * SWR hook for the personalized For You feed.
 */

import { useMemo } from 'react'
import useSWR from 'swr'
import type { NewsArticle } from '@/lib/shared/types'
import { useAuth } from '@/lib/hooks/use-auth'

interface ForYouApiResponse {
  readonly success: boolean
  readonly data: NewsArticle[]
  readonly meta: {
    readonly total: number
    readonly page: number
    readonly limit: number
  }
}

export function useForYou(page = 1) {
  const { user } = useAuth()

  const { data, error, isLoading, mutate } = useSWR<ForYouApiResponse>(
    user ? `/api/stories/for-you?page=${page}` : null,
    {
      dedupingInterval: 5000,
    }
  )

  const stories = useMemo(() => data?.data ?? [], [data])

  return {
    stories,
    total: data?.meta?.total ?? 0,
    isLoading,
    isError: !!error,
    isAuthenticated: !!user,
    mutate,
  }
}
