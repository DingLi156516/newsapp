/**
 * lib/hooks/use-bias-profile.ts — SWR hook for the user's bias profile.
 *
 * Fetches the computed bias distribution from the dashboard API.
 */

import useSWR from 'swr'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'
import type { BiasProfile } from '@/lib/api/bias-calculator'

interface BiasProfileApiResponse {
  readonly success: boolean
  readonly data: BiasProfile
}

export function useBiasProfile() {
  const { user } = useAuth()

  const { data, error, isLoading } = useSWR<BiasProfileApiResponse>(
    user ? '/api/dashboard/bias-profile' : null,
    fetcher,
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
