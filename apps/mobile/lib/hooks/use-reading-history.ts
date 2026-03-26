/**
 * SWR hook for reading history.
 * Authenticated users: server-backed via API.
 * Unauthenticated users: local storage via AsyncStorage.
 */

import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/use-auth'
import { useLocalReadingHistory } from '@/lib/hooks/use-local-reading-history'
import { authFetch } from '@/lib/hooks/fetcher'

interface ReadingHistoryApiResponse {
  readonly success: boolean
  readonly data: string[]
}

export function useReadingHistory() {
  const { user } = useAuth()
  const { localIds, addLocal, removeLocal } = useLocalReadingHistory()

  const { data, mutate } = useSWR<ReadingHistoryApiResponse>(
    user ? '/api/reading-history' : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      fallbackData: { success: true, data: [] },
    }
  )

  const serverReadIds = useMemo(() => new Set(data?.data ?? []), [data?.data])

  const isRead = useCallback(
    (storyId: string): boolean => {
      if (!user) return localIds.has(storyId)
      return serverReadIds.has(storyId)
    },
    [user, serverReadIds, localIds]
  )

  const markAsRead = useCallback(
    async (storyId: string) => {
      if (!user) {
        if (!localIds.has(storyId)) {
          addLocal(storyId)
        }
        return
      }

      if (serverReadIds.has(storyId)) return

      const optimisticData: ReadingHistoryApiResponse = {
        success: true,
        data: [...(data?.data ?? []), storyId],
      }
      await mutate(optimisticData, false)

      try {
        await authFetch(`/api/reading-history/${storyId}`, { method: 'POST' })
        await mutate()
      } catch {
        await mutate()
      }
    },
    [user, localIds, serverReadIds, data, mutate, addLocal]
  )

  const markAsUnread = useCallback(
    async (storyId: string) => {
      if (!user) {
        removeLocal(storyId)
        return
      }

      const optimisticData: ReadingHistoryApiResponse = {
        success: true,
        data: (data?.data ?? []).filter((id) => id !== storyId),
      }
      await mutate(optimisticData, false)

      try {
        await authFetch(`/api/reading-history/${storyId}`, { method: 'DELETE' })
        await mutate()
      } catch {
        await mutate()
      }
    },
    [user, data, mutate, removeLocal]
  )

  const readStoryIds = useMemo(() => {
    if (!user) return [...localIds]
    return Array.from(serverReadIds)
  }, [user, localIds, serverReadIds])

  return {
    isRead,
    markAsRead,
    markAsUnread,
    readCount: user ? serverReadIds.size : localIds.size,
    readStoryIds,
  }
}
