/**
 * useFeedConfig — Local feed configuration via AsyncStorage.
 * Stores visible_feeds and feed_sort on device for all users (no auth required).
 */

import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { FeedSort, UnifiedTab } from '@/lib/shared/types'
import { DEFAULT_VISIBLE_FEEDS } from '@/lib/shared/types'

const KEYS = {
  visibleFeeds: '@axiom/visible_feeds',
  feedSort: '@axiom/feed_sort',
} as const

export interface FeedConfig {
  readonly visibleFeeds: readonly UnifiedTab[]
  readonly feedSort: FeedSort
}

const DEFAULTS: FeedConfig = {
  visibleFeeds: DEFAULT_VISIBLE_FEEDS,
  feedSort: 'most-covered',
}

export function useFeedConfig() {
  const [config, setConfig] = useState<FeedConfig>(DEFAULTS)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [feedsJson, sort] = await Promise.all([
          AsyncStorage.getItem(KEYS.visibleFeeds),
          AsyncStorage.getItem(KEYS.feedSort),
        ])
        setConfig({
          visibleFeeds: feedsJson ? JSON.parse(feedsJson) : DEFAULTS.visibleFeeds,
          feedSort: (sort as FeedSort) ?? DEFAULTS.feedSort,
        })
      } catch {
        // Use defaults on error
      }
      setIsLoaded(true)
    }
    load()
  }, [])

  const updateConfig = useCallback(async (updates: Partial<FeedConfig>) => {
    const next: FeedConfig = { ...config, ...updates }
    setConfig(next)
    try {
      if (updates.visibleFeeds !== undefined) {
        await AsyncStorage.setItem(KEYS.visibleFeeds, JSON.stringify(next.visibleFeeds))
      }
      if (updates.feedSort !== undefined) {
        await AsyncStorage.setItem(KEYS.feedSort, next.feedSort)
      }
    } catch {
      // Silent fail — state is already updated in memory
    }
  }, [config])

  return { ...config, isLoaded, updateConfig }
}
