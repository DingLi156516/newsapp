/**
 * lib/hooks/use-suggestions.ts — SWR hook for bias-aware story suggestions.
 *
 * Fetches stories from underrepresented bias categories.
 */

import useSWR from 'swr'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'
import type { NewsArticle } from '@/lib/types'

interface SuggestionsApiResponse {
  readonly success: boolean
  readonly data: NewsArticle[]
}

export function useSuggestions() {
  const { user } = useAuth()

  const { data, error, isLoading } = useSWR<SuggestionsApiResponse>(
    user ? '/api/dashboard/suggestions' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  return {
    suggestions: data?.data ?? [],
    isLoading,
    isError: !!error,
  }
}
