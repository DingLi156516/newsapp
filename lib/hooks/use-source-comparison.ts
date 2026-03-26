import useSWR from 'swr'
import type { SourceComparison } from '@/lib/types'
import { fetcher } from '@/lib/hooks/fetcher'
import { buildSampleSourceComparison } from '@/lib/source-comparison'

interface SourceComparisonApiResponse {
  readonly success: boolean
  readonly data: SourceComparison
}

export function useSourceComparison(leftSlug: string | null, rightSlug: string | null) {
  const url = leftSlug && rightSlug
    ? `/api/sources/compare?left=${encodeURIComponent(leftSlug)}&right=${encodeURIComponent(rightSlug)}`
    : null

  const { data, error, isLoading } = useSWR<SourceComparisonApiResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )

  const fallback = leftSlug && rightSlug
    ? buildSampleSourceComparison(leftSlug, rightSlug)
    : null
  const comparison = data?.data ?? fallback

  return {
    comparison,
    isLoading,
    isError: !!error && !comparison,
    error,
  }
}
