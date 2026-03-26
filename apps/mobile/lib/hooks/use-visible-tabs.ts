/**
 * Derived hook for ordered visible feed tabs.
 * Returns feeds first (in canonical order), then topics (in canonical order).
 */

import { useMemo } from 'react'
import { ALL_FEED_TABS, ALL_TOPICS, DEFAULT_VISIBLE_FEEDS } from '@/lib/shared/types'
import type { UnifiedTab } from '@/lib/shared/types'

const CANONICAL_ORDER: readonly UnifiedTab[] = [...ALL_FEED_TABS, ...ALL_TOPICS]

export function useVisibleTabs(visibleFeeds: readonly UnifiedTab[]) {
  const visibleTabs = useMemo(() => {
    const enabled = new Set<string>(visibleFeeds)
    const ordered = CANONICAL_ORDER.filter((tab) => enabled.has(tab))
    return ordered.length > 0 ? ordered : [...DEFAULT_VISIBLE_FEEDS]
  }, [visibleFeeds])

  return { visibleTabs }
}
