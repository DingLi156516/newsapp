import useSWR from 'swr'
import type { SourceProfile } from '@/lib/types'
import { fetcher } from '@/lib/hooks/fetcher'
import { buildSampleSourceProfile } from '@/lib/source-profiles'

interface SourceProfileApiResponse {
  readonly success: boolean
  readonly data: SourceProfile
}

export function useSourceProfile(slug: string) {
  const { data, error, isLoading } = useSWR<SourceProfileApiResponse>(
    slug ? `/api/sources/${slug}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )

  const fallback = slug ? buildSampleSourceProfile(slug) : null
  const profile = data?.data ?? fallback

  return {
    profile,
    isLoading,
    isError: !!error && !profile,
    error,
  }
}
