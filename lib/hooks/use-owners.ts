/**
 * lib/hooks/use-owners.ts — SWR hook for fetching media owners.
 */

import useSWR from 'swr'
import { fetcher } from '@/lib/hooks/fetcher'
import type { MediaOwner } from '@/lib/types'

interface OwnersResponse {
  readonly success: boolean
  readonly data: MediaOwner[]
  readonly meta: {
    readonly total: number
    readonly page: number
    readonly limit: number
  }
}

export function useOwners() {
  const { data, error, isLoading } = useSWR<OwnersResponse>(
    '/api/owners?limit=200',
    fetcher
  )

  return {
    owners: data?.data ?? [],
    error,
    isLoading,
  }
}
