/**
 * lib/offline/cache-manager.ts — Cache API wrappers for offline story access.
 *
 * Provides methods to cache, uncache, retrieve, and list cached story data
 * using the browser's Cache API. Works with the service worker for offline access.
 */

const STORY_CACHE_NAME = 'axiom-stories-v1'

function getStoryUrl(storyId: string): string {
  return `/api/stories/${storyId}`
}

export async function cacheStory(storyId: string): Promise<void> {
  if (typeof caches === 'undefined') return

  try {
    const response = await fetch(getStoryUrl(storyId))
    if (!response.ok) return

    const cache = await caches.open(STORY_CACHE_NAME)
    await cache.put(getStoryUrl(storyId), response)
  } catch {
    // Silently fail — caching is best-effort
  }
}

export async function uncacheStory(storyId: string): Promise<void> {
  if (typeof caches === 'undefined') return

  try {
    const cache = await caches.open(STORY_CACHE_NAME)
    await cache.delete(getStoryUrl(storyId))
  } catch {
    // Silently fail
  }
}

export async function getCachedStory(storyId: string): Promise<unknown | null> {
  if (typeof caches === 'undefined') return null

  try {
    const cache = await caches.open(STORY_CACHE_NAME)
    const response = await cache.match(getStoryUrl(storyId))
    if (!response) return null

    return await response.json()
  } catch {
    return null
  }
}

export async function getCachedStoryIds(): Promise<string[]> {
  if (typeof caches === 'undefined') return []

  try {
    const cache = await caches.open(STORY_CACHE_NAME)
    const keys = await cache.keys()

    return keys
      .map((req) => {
        const match = req.url.match(/\/api\/stories\/([^/]+)$/)
        return match?.[1] ?? null
      })
      .filter((id): id is string => id !== null)
  } catch {
    return []
  }
}
