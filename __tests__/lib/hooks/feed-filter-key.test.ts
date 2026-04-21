import { describe, it, expect } from 'vitest'
import { buildFeedFilterKey, type FeedFilterKeyInput } from '@/lib/hooks/feed-filter-key'
import { ALL_BIASES } from '@/lib/types'

function base(overrides: Partial<FeedFilterKeyInput> = {}): FeedFilterKeyInput {
  return {
    topic: null,
    tag: null,
    tagType: null,
    owner: null,
    region: null,
    search: '',
    feedTab: 'latest',
    biasRange: ALL_BIASES,
    minFactuality: null,
    datePreset: 'all',
    ...overrides,
  }
}

describe('buildFeedFilterKey', () => {
  it('is stable for identical inputs', () => {
    expect(buildFeedFilterKey(base())).toBe(buildFeedFilterKey(base()))
  })

  it('changes when switching to trending (regression: codex adversarial finding)', () => {
    // When the user paginates Latest and then switches to Trending, the
    // accumulator must reset; the fetched query is not the same shape.
    const latest = buildFeedFilterKey(base({ feedTab: 'latest' }))
    const trending = buildFeedFilterKey(base({ feedTab: 'trending' }))
    expect(latest).not.toBe(trending)
  })

  it('changes when switching to blindspot', () => {
    const latest = buildFeedFilterKey(base({ feedTab: 'latest' }))
    const blindspot = buildFeedFilterKey(base({ feedTab: 'blindspot' }))
    expect(latest).not.toBe(blindspot)
  })

  it('is identical when switching between client-only tabs (latest/saved/for-you)', () => {
    // Those tabs don't change the server query — switching them should NOT
    // reset the accumulator or cause a network refetch loop.
    const latest = buildFeedFilterKey(base({ feedTab: 'latest' }))
    const saved = buildFeedFilterKey(base({ feedTab: 'saved' }))
    const forYou = buildFeedFilterKey(base({ feedTab: 'for-you' }))
    expect(latest).toBe(saved)
    expect(latest).toBe(forYou)
  })

  it('changes when topic changes', () => {
    expect(buildFeedFilterKey(base({ topic: 'politics' }))).not.toBe(
      buildFeedFilterKey(base({ topic: 'technology' }))
    )
  })

  it('changes when search changes', () => {
    expect(buildFeedFilterKey(base({ search: 'foo' }))).not.toBe(
      buildFeedFilterKey(base({ search: 'bar' }))
    )
  })

  it('changes when biasRange changes', () => {
    expect(buildFeedFilterKey(base({ biasRange: ['left'] }))).not.toBe(
      buildFeedFilterKey(base({ biasRange: ['right'] }))
    )
  })

  it('changes when owner changes', () => {
    expect(buildFeedFilterKey(base({ owner: 'fox-corporation' }))).not.toBe(
      buildFeedFilterKey(base({ owner: 'dow-jones' }))
    )
    expect(buildFeedFilterKey(base({ owner: 'fox-corporation' }))).not.toBe(
      buildFeedFilterKey(base())
    )
  })

  it('is stable across trending/latest tab switch when owner filter is active', () => {
    // With an active owner filter, sort=trending is suppressed at the client
    // and the server routes through the owner-specific path either way.
    // Toggling tabs hits the same backend request, so the cache key must stay
    // identical — otherwise `accumulated` resets and page 1 refetches for an
    // identical query, costing already-loaded pages on long owner feeds.
    const latest = buildFeedFilterKey(base({ owner: 'fox-corporation', feedTab: 'latest' }))
    const trending = buildFeedFilterKey(base({ owner: 'fox-corporation', feedTab: 'trending' }))
    expect(latest).toBe(trending)
  })

  it('is stable across blindspot/latest tab switch when owner filter is active', () => {
    // Same pattern: owner filter suppresses the blindspot server filter, so
    // /?owner=X and /?owner=X&tab=blindspot hit identical backend queries.
    // Cache key must match so accumulator survives the no-op tab toggle.
    const latest = buildFeedFilterKey(base({ owner: 'fox-corporation', feedTab: 'latest' }))
    const blindspot = buildFeedFilterKey(base({ owner: 'fox-corporation', feedTab: 'blindspot' }))
    expect(latest).toBe(blindspot)
  })
})
