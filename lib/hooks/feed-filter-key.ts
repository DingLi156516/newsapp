/**
 * lib/hooks/feed-filter-key.ts — Stable cache key for the home feed accumulator.
 *
 * app/page.tsx maintains an `accumulated` list of stories across paginated
 * fetches. When any filter that affects the *server response* changes, we must
 * reset the accumulator and re-fetch from page 1 — otherwise a page-2 result
 * from the new query gets appended to a stale page-1 from the old query.
 *
 * Only include filters that change what the API returns:
 *   - topic / tag / tagType / region / search / biasRange / minFactuality / datePreset
 *   - blindspot (feedTab === 'blindspot') — server filter
 *   - trending  (feedTab === 'trending')  — server sort
 *
 * Client-only feed tabs (`latest` re-sorts, `saved` filters, `for-you` uses a
 * separate endpoint) intentionally do *not* participate in this key.
 */

import type { BiasCategory, DatePreset, FactualityLevel, FeedTab, Region, Topic } from '@/lib/types'

export interface FeedFilterKeyInput {
  readonly topic: Topic | null
  readonly tag: string | null
  readonly tagType: string | null
  readonly owner: string | null
  readonly region: Region | null
  readonly search: string
  readonly feedTab: FeedTab
  readonly biasRange: readonly BiasCategory[]
  readonly minFactuality: FactualityLevel | null
  readonly datePreset: DatePreset
}

export function buildFeedFilterKey(input: FeedFilterKeyInput): string {
  // When an owner filter is active, app/page.tsx suppresses both `sort=trending`
  // and the blindspot server filter — the backend routes through the
  // owner-specific path regardless of which tab is highlighted. Both
  // distinctions drop out of the cache key in that case, otherwise switching
  // tabs (Latest↔Trending or Latest↔Blindspot) for an identical backend query
  // would reset `accumulated` and refetch page 1 for no real change. See
  // Codex review round 9 P3 + round 14 P3.
  const serverSeesTrending = input.feedTab === 'trending' && !input.owner
  const serverSeesBlindspot = input.feedTab === 'blindspot' && !input.owner
  return JSON.stringify([
    input.topic,
    input.tag,
    input.tagType,
    input.owner,
    input.region,
    input.search,
    serverSeesBlindspot,
    serverSeesTrending,
    input.biasRange,
    input.minFactuality,
    input.datePreset,
  ])
}
