/**
 * SWR hook for user preferences. Uses authFetch for mobile.
 */

import { useCallback } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/use-auth'
import { authFetch } from '@/lib/hooks/fetcher'
import type { PerspectiveFilter, FactualityLevel, Topic } from '@/lib/shared/types'

export interface UserPreferences {
  readonly followed_topics: Topic[]
  readonly default_perspective: PerspectiveFilter
  readonly factuality_minimum: FactualityLevel
  readonly blindspot_digest_enabled: boolean
}

const DEFAULT_PREFERENCES: UserPreferences = {
  followed_topics: [],
  default_perspective: 'all',
  factuality_minimum: 'mixed',
  blindspot_digest_enabled: false,
}

interface PreferencesApiResponse {
  readonly success: boolean
  readonly data: UserPreferences
}

export function usePreferences() {
  const { user } = useAuth()

  const { data, mutate, isLoading } = useSWR<PreferencesApiResponse>(
    user ? '/api/preferences' : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      fallbackData: { success: true, data: DEFAULT_PREFERENCES },
    }
  )

  const preferences = data?.data ?? DEFAULT_PREFERENCES

  const updatePreferences = useCallback(
    async (updates: Partial<UserPreferences>) => {
      if (!user) return

      const optimisticData: PreferencesApiResponse = {
        success: true,
        data: { ...preferences, ...updates },
      }
      await mutate(optimisticData, false)

      try {
        await authFetch('/api/preferences', {
          method: 'PATCH',
          body: JSON.stringify(updates),
        })
        await mutate()
      } catch (error) {
        await mutate()
        throw error
      }
    },
    [user, preferences, mutate]
  )

  return {
    preferences,
    updatePreferences,
    isLoading,
  }
}
