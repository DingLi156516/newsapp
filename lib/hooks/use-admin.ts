/**
 * lib/hooks/use-admin.ts — Lightweight admin status check hook.
 *
 * Checks /api/admin/review/stats to determine if user has admin access.
 */

import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/use-auth'

interface AdminCheckResponse {
  readonly success: boolean
}

async function adminFetcher(url: string): Promise<AdminCheckResponse> {
  const res = await fetch(url)
  if (res.status === 403) {
    return { success: false }
  }
  if (!res.ok) {
    throw new Error(`Admin check failed: ${res.status}`)
  }
  return { success: true }
}

export function useAdmin() {
  const { user } = useAuth()

  const { data, isLoading } = useSWR(
    user ? '/api/admin/review/stats' : null,
    adminFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  return {
    isAdmin: data?.success ?? false,
    isLoading,
  }
}
