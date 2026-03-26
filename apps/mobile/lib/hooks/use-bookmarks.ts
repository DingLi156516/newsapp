/**
 * SWR hook for persistent bookmarks.
 * Authenticated users: server-backed via API.
 * Unauthenticated users: local storage via AsyncStorage.
 */

import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/use-auth'
import { useLocalBookmarks } from '@/lib/hooks/use-local-bookmarks'
import { authFetch } from '@/lib/hooks/fetcher'
import { cacheStory, uncacheStory } from '@/lib/offline/cache-manager'

interface BookmarksApiResponse {
  readonly success: boolean
  readonly data: string[]
}

export type ToggleResult = 'toggled'

export function useBookmarks() {
  const { user } = useAuth()
  const { localIds, addLocal, removeLocal } = useLocalBookmarks()

  const { data, mutate } = useSWR<BookmarksApiResponse>(
    user ? '/api/bookmarks' : null,
    {
      dedupingInterval: 5000,
      fallbackData: { success: true, data: [] },
    }
  )

  const serverBookmarks = useMemo(() => new Set(data?.data ?? []), [data?.data])

  const isBookmarked = useCallback(
    (storyId: string): boolean => {
      if (!user) return localIds.has(storyId)
      return serverBookmarks.has(storyId)
    },
    [user, serverBookmarks, localIds]
  )

  const toggle = useCallback(
    async (storyId: string, forceAction?: 'add' | 'remove'): Promise<ToggleResult> => {
      if (!user) {
        const currentlyBookmarked = forceAction
          ? forceAction === 'remove'
          : localIds.has(storyId)

        if (currentlyBookmarked) {
          removeLocal(storyId)
          uncacheStory(storyId)
        } else {
          addLocal(storyId)
          cacheStory(storyId)
        }
        return 'toggled'
      }

      // Authenticated path — server API
      const currentlyBookmarked = forceAction
        ? forceAction === 'remove'
        : serverBookmarks.has(storyId)

      const optimisticData: BookmarksApiResponse = {
        success: true,
        data: currentlyBookmarked
          ? (data?.data ?? []).filter((id) => id !== storyId)
          : [...(data?.data ?? []), storyId],
      }
      await mutate(optimisticData, false)

      try {
        const res = currentlyBookmarked
          ? await authFetch(`/api/bookmarks/${storyId}`, { method: 'DELETE' })
          : await authFetch('/api/bookmarks', {
              method: 'POST',
              body: JSON.stringify({ storyId }),
            })

        if (!res.ok) {
          throw new Error(`Bookmark ${currentlyBookmarked ? 'remove' : 'save'} failed: ${res.status}`)
        }

        if (currentlyBookmarked) {
          uncacheStory(storyId)
        } else {
          cacheStory(storyId)
        }

        await mutate()
      } catch (error) {
        await mutate()
        throw error
      }

      return 'toggled'
    },
    [user, localIds, serverBookmarks, data, mutate, addLocal, removeLocal]
  )

  const bookmarkedIds = useMemo(() => {
    if (!user) return localIds
    return serverBookmarks
  }, [user, localIds, serverBookmarks])

  return {
    isBookmarked,
    toggle,
    count: bookmarkedIds.size,
    bookmarkedIds,
  }
}
