import useSWR from 'swr'
import type { OwnerProfile } from '@/lib/types'
import { fetcher } from '@/lib/hooks/fetcher'

interface OwnerProfileApiResponse {
  readonly success: boolean
  readonly data: OwnerProfile
}

function is404(error: unknown): boolean {
  // fetcher throws `new Error("API error 404: ...")` on non-OK responses; we
  // sniff the status code out of the message so the page can distinguish
  // "owner doesn't exist" (render not-found) from "backend failed" (render
  // retry). String matching beats an upstream refactor since fetcher is
  // shared across hooks that rely on its contract.
  return error instanceof Error && /^API error 404\b/.test(error.message)
}

export function useOwnerProfile(slug: string) {
  const { data, error, isLoading } = useSWR<OwnerProfileApiResponse>(
    slug ? `/api/owners/by-slug/${encodeURIComponent(slug)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )

  const profile = data?.data ?? null
  const notFound = is404(error)

  return {
    profile,
    isLoading,
    notFound,
    isError: !!error && !profile && !notFound,
    error,
  }
}
