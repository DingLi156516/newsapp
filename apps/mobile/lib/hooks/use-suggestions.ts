/**
 * SWR hook for bias-aware story suggestions.
 */

import { useMemo } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/use-auth'
import type { NewsArticle } from '@/lib/shared/types'

interface SuggestionsApiResponse {
  readonly success: boolean
  readonly data: NewsArticle[]
}

export function useSuggestions() {
  const { user } = useAuth()

  const { data, error, isLoading } = useSWR<SuggestionsApiResponse>(
    user ? '/api/dashboard/suggestions' : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  const suggestions = useMemo(() => data?.data ?? [], [data])

  return {
    suggestions,
    isLoading,
    isError: !!error,
  }
}
