/**
 * lib/hooks/use-reading-history.ts — SWR hook for tracking reading history.
 *
 * Provides markAsRead/markAsUnread/isRead for authenticated users.
 * Returns no-ops for anonymous users.
 */

import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'

interface ReadingHistoryApiResponse {
  readonly success: boolean
  readonly data: string[]
}

export function useReadingHistory() {
  const { user } = useAuth()

  const { data, mutate } = useSWR<ReadingHistoryApiResponse>(
    user ? '/api/reading-history' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      fallbackData: { success: true, data: [] },
    }
  )

  const readIds = useMemo(() => new Set(data?.data ?? []), [data?.data])

  const isRead = useCallback(
    (storyId: string): boolean => {
      if (!user) return false
      return readIds.has(storyId)
    },
    [user, readIds]
  )

  const markAsRead = useCallback(
    async (storyId: string) => {
      if (!user) return
      if (readIds.has(storyId)) return

      // Optimistic update
      const optimisticData: ReadingHistoryApiResponse = {
        success: true,
        data: [...(data?.data ?? []), storyId],
      }
      await mutate(optimisticData, false)

      try {
        await fetch(`/api/reading-history/${storyId}`, { method: 'POST' })
        await mutate()
      } catch {
        await mutate()
      }
    },
    [user, readIds, data, mutate]
  )

  const markAsUnread = useCallback(
    async (storyId: string) => {
      if (!user) return

      // Optimistic update
      const optimisticData: ReadingHistoryApiResponse = {
        success: true,
        data: (data?.data ?? []).filter((id) => id !== storyId),
      }
      await mutate(optimisticData, false)

      try {
        await fetch(`/api/reading-history/${storyId}`, { method: 'DELETE' })
        await mutate()
      } catch {
        await mutate()
      }
    },
    [user, data, mutate]
  )

  return {
    isRead,
    markAsRead,
    markAsUnread,
    readCount: readIds.size,
  }
}
