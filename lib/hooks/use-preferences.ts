/**
 * lib/hooks/use-preferences.ts — SWR hook for user preferences.
 *
 * Returns preferences from the API for authenticated users, or sensible
 * defaults for anonymous users. Supports optimistic updates via SWR mutate.
 */

import { useCallback } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'
import type { PerspectiveFilter, FactualityLevel, Topic } from '@/lib/types'

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
    fetcher,
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

      // Optimistic update
      const optimisticData: PreferencesApiResponse = {
        success: true,
        data: { ...preferences, ...updates },
      }
      await mutate(optimisticData, false)

      try {
        await fetch('/api/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
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
