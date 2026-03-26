/**
 * useLocalBookmarks — AsyncStorage-backed bookmark storage for unauthenticated users.
 * Follows the useFeedConfig pattern: load on mount, optimistic updates, silent fail.
 */

import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@axiom/local_bookmarks'

export interface LocalBookmarksHook {
  readonly localIds: ReadonlySet<string>
  readonly isLoaded: boolean
  readonly addLocal: (storyId: string) => void
  readonly removeLocal: (storyId: string) => void
  readonly clearLocal: () => void
}

/**
 * Standalone reader for merge logic (auth-provider) — no hook dependency.
 */
export async function readLocalBookmarks(): Promise<ReadonlySet<string>> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY)
    if (!json) return new Set()
    const ids: string[] = JSON.parse(json)
    return new Set(ids)
  } catch {
    return new Set()
  }
}

/**
 * Clear local bookmarks after successful merge.
 */
export async function clearLocalBookmarks(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY)
  } catch {
    // Silent fail
  }
}

export function useLocalBookmarks(): LocalBookmarksHook {
  const [localIds, setLocalIds] = useState<ReadonlySet<string>>(new Set())
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY)
        if (json) {
          const ids: string[] = JSON.parse(json)
          setLocalIds(new Set(ids))
        }
      } catch {
        // Use empty set on error
      }
      setIsLoaded(true)
    }
    load()
  }, [])

  const persist = useCallback(async (ids: ReadonlySet<string>) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
    } catch {
      // Silent fail — state is already updated in memory
    }
  }, [])

  const addLocal = useCallback((storyId: string) => {
    setLocalIds(prev => {
      const next = new Set(prev)
      next.add(storyId)
      persist(next)
      return next
    })
  }, [persist])

  const removeLocal = useCallback((storyId: string) => {
    setLocalIds(prev => {
      const next = new Set(prev)
      next.delete(storyId)
      persist(next)
      return next
    })
  }, [persist])

  const clearLocal = useCallback(() => {
    setLocalIds(new Set())
    clearLocalBookmarks()
  }, [])

  return { localIds, isLoaded, addLocal, removeLocal, clearLocal }
}
