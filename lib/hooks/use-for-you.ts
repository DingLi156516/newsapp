/**
 * lib/hooks/use-for-you.ts — SWR hook for the "For You" personalized feed.
 *
 * Returns ranked stories for authenticated users. Passes `null` as the SWR key
 * when unauthenticated (disables the fetch entirely — SWR skips requests
 * when the key is null/undefined/false).
 */

import useSWR from 'swr'
import type { NewsArticle } from '@/lib/types'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'

interface ForYouParams {
  readonly page?: number
  readonly limit?: number
}

interface ForYouApiResponse {
  readonly success: boolean
  readonly data: NewsArticle[]
  readonly meta: {
    readonly total: number
    readonly page: number
    readonly limit: number
  }
}

function buildForYouUrl(params: ForYouParams): string {
  const searchParams = new URLSearchParams()

  if (params.page && params.page > 1) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))

  const qs = searchParams.toString()
  return `/api/stories/for-you${qs ? `?${qs}` : ''}`
}

export function useForYou(params: ForYouParams = {}) {
  const { user } = useAuth()
  const url = buildForYouUrl(params)

  const { data, error, isLoading } = useSWR<ForYouApiResponse>(
    user ? url : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  )

  return {
    stories: data?.data ?? [],
    total: data?.meta?.total ?? 0,
    isLoading,
    isError: !!error,
    isAuthenticated: !!user,
  }
}
