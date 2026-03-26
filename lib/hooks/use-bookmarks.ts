/**
 * lib/hooks/use-bookmarks.ts — SWR hook for persistent bookmarks.
 *
 * Uses Supabase when authenticated, local Set when anonymous.
 * Provides optimistic updates for server bookmarks.
 */

import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'
import { cacheStory, uncacheStory } from '@/lib/offline/cache-manager'

interface BookmarksApiResponse {
  readonly success: boolean
  readonly data: string[]
}

export function useBookmarks() {
  const { user } = useAuth()
  const [localBookmarks, setLocalBookmarks] = useState<Set<string>>(new Set())

  const { data, mutate } = useSWR<BookmarksApiResponse>(
    user ? '/api/bookmarks' : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      fallbackData: { success: true, data: [] },
    }
  )

  const serverBookmarks = useMemo(() => new Set(data?.data ?? []), [data?.data])

  const isBookmarked = useCallback(
    (storyId: string): boolean => {
      if (user) return serverBookmarks.has(storyId)
      return localBookmarks.has(storyId)
    },
    [user, serverBookmarks, localBookmarks]
  )

  const toggle = useCallback(
    async (storyId: string) => {
      if (!user) {
        setLocalBookmarks((prev) => {
          const next = new Set(prev)
          if (next.has(storyId)) {
            next.delete(storyId)
          } else {
            next.add(storyId)
          }
          return next
        })
        return
      }

      const currentlyBookmarked = serverBookmarks.has(storyId)

      // Optimistic update
      const optimisticData: BookmarksApiResponse = {
        success: true,
        data: currentlyBookmarked
          ? (data?.data ?? []).filter((id) => id !== storyId)
          : [...(data?.data ?? []), storyId],
      }
      await mutate(optimisticData, false)

      try {
        const res = currentlyBookmarked
          ? await fetch(`/api/bookmarks/${storyId}`, { method: 'DELETE' })
          : await fetch('/api/bookmarks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ storyId }),
            })

        if (!res.ok) {
          throw new Error(`Bookmark ${currentlyBookmarked ? 'remove' : 'save'} failed: ${res.status}`)
        }

        // Fire-and-forget: cache or uncache story for offline access
        if (currentlyBookmarked) {
          uncacheStory(storyId)
        } else {
          cacheStory(storyId)
        }

        await mutate()
      } catch (error) {
        // Revert optimistic update on error
        await mutate()
        throw error
      }
    },
    [user, serverBookmarks, data, mutate]
  )

  const bookmarkCount = user ? serverBookmarks.size : localBookmarks.size

  return {
    isBookmarked,
    toggle,
    count: bookmarkCount,
    bookmarkedIds: user ? serverBookmarks : localBookmarks,
  }
}
