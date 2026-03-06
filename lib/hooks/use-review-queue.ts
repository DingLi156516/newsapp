/**
 * lib/hooks/use-review-queue.ts — SWR hook for the admin review queue.
 *
 * Fetches paginated stories filtered by review status.
 */

import useSWR from 'swr'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'
import type { ReviewStatus } from '@/lib/types'

interface ReviewQueueOptions {
  readonly status?: ReviewStatus
  readonly page?: number
  readonly limit?: number
}

interface ReviewStory {
  readonly id: string
  readonly headline: string
  readonly topic: string
  readonly region: string
  readonly source_count: number
  readonly is_blindspot: boolean
  readonly image_url: string | null
  readonly factuality: string
  readonly ownership: string
  readonly spectrum_segments: unknown
  readonly ai_summary: unknown
  readonly review_status: string
  readonly reviewed_by: string | null
  readonly reviewed_at: string | null
  readonly first_published: string
  readonly last_updated: string
}

interface ReviewQueueResponse {
  readonly success: boolean
  readonly data: ReviewStory[]
  readonly meta: {
    readonly total: number
    readonly page: number
    readonly limit: number
  }
}

export function useReviewQueue(options: ReviewQueueOptions = {}) {
  const { user } = useAuth()
  const { status, page = 1, limit = 20 } = options

  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (page !== 1) params.set('page', String(page))
  if (limit !== 20) params.set('limit', String(limit))

  const queryString = params.toString()
  const url = `/api/admin/review${queryString ? `?${queryString}` : ''}`

  const { data, mutate, isLoading } = useSWR<ReviewQueueResponse>(
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
    mutate,
  }
}
