import { describe, it, expect } from 'vitest'
import { buildFeedFilterKey, type FeedFilterKeyInput } from '@/lib/hooks/feed-filter-key'
import { ALL_BIASES } from '@/lib/types'

function base(overrides: Partial<FeedFilterKeyInput> = {}): FeedFilterKeyInput {
  return {
    topic: null,
    tag: null,
    tagType: null,
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
})
