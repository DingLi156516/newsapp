/**
 * AsyncStorage-based offline cache for story data.
 * Replaces web app's Cache API implementation.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { NewsArticle } from '@/lib/shared/types'

const CACHE_PREFIX = 'axiom-story-'
const CACHE_INDEX_KEY = 'axiom-cached-story-ids'

function getStoryKey(storyId: string): string {
  return `${CACHE_PREFIX}${storyId}`
}

export async function cacheStory(storyId: string): Promise<void> {
  try {
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? ''
    const res = await fetch(`${apiBaseUrl}/api/stories/${storyId}`)
    if (!res.ok) return

    const data = await res.json()
    await AsyncStorage.setItem(getStoryKey(storyId), JSON.stringify(data.data))

    // Update index
    const ids = await getCachedStoryIds()
    if (!ids.includes(storyId)) {
      await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify([...ids, storyId]))
    }
  } catch {
    // Silently fail — caching is best-effort
  }
}

export async function uncacheStory(storyId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(getStoryKey(storyId))

    const ids = await getCachedStoryIds()
    const updated = ids.filter((id) => id !== storyId)
    await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(updated))
  } catch {
    // Silently fail
  }
}

export async function getCachedStory(storyId: string): Promise<NewsArticle | null> {
  try {
    const raw = await AsyncStorage.getItem(getStoryKey(storyId))
    if (!raw) return null
    return JSON.parse(raw) as NewsArticle
  } catch {
    return null
  }
}

export async function getCachedStoryIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_INDEX_KEY)
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}
