/**
 * SWR hook for the user's bias reading profile.
 */

import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/use-auth'
import type { BiasCategory } from '@/lib/shared/types'

interface BiasDistribution {
  readonly bias: BiasCategory
  readonly percentage: number
  readonly count: number
}

interface BiasProfile {
  readonly userDistribution: BiasDistribution[]
  readonly overallDistribution: BiasDistribution[]
  readonly totalStoriesRead: number
  readonly blindspots: BiasCategory[]
  readonly dominantBias: BiasCategory | null
}

interface BiasProfileApiResponse {
  readonly success: boolean
  readonly data: BiasProfile
}

export function useBiasProfile() {
  const { user } = useAuth()

  const { data, error, isLoading } = useSWR<BiasProfileApiResponse>(
    user ? '/api/dashboard/bias-profile' : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  return {
    profile: data?.data ?? null,
    isLoading,
    isError: !!error,
  }
}
