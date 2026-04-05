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
  hiddenPromotedTags: '@axiom/hidden_promoted_tags',
} as const

export interface FeedConfig {
  readonly visibleFeeds: readonly UnifiedTab[]
  readonly feedSort: FeedSort
  readonly hiddenPromotedTags: readonly string[]
}

const DEFAULTS: FeedConfig = {
  visibleFeeds: DEFAULT_VISIBLE_FEEDS,
  feedSort: 'most-covered',
  hiddenPromotedTags: [],
}

export function useFeedConfig() {
  const [config, setConfig] = useState<FeedConfig>(DEFAULTS)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [feedsJson, sort, hiddenJson] = await Promise.all([
          AsyncStorage.getItem(KEYS.visibleFeeds),
          AsyncStorage.getItem(KEYS.feedSort),
          AsyncStorage.getItem(KEYS.hiddenPromotedTags),
        ])
        setConfig({
          visibleFeeds: feedsJson ? JSON.parse(feedsJson) : DEFAULTS.visibleFeeds,
          feedSort: (sort as FeedSort) ?? DEFAULTS.feedSort,
          hiddenPromotedTags: hiddenJson
            ? (JSON.parse(hiddenJson) as string[]).filter((s) => s.includes(':'))
            : DEFAULTS.hiddenPromotedTags,
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
      if (updates.hiddenPromotedTags !== undefined) {
        await AsyncStorage.setItem(KEYS.hiddenPromotedTags, JSON.stringify(next.hiddenPromotedTags))
      }
    } catch {
      // Silent fail — state is already updated in memory
    }
  }, [config])

  return { ...config, isLoaded, updateConfig }
}
