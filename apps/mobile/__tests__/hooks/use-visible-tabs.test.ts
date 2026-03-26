import type { UnifiedTab } from '@/lib/shared/types'
import { renderHook } from '@testing-library/react-native'
import { useVisibleTabs } from '@/lib/hooks/use-visible-tabs'

describe('useVisibleTabs', () => {
  it('returns tabs in canonical order: feeds first, then topics', () => {
    const feeds: UnifiedTab[] = ['for-you', 'trending', 'latest', 'politics', 'technology', 'world']
    const { result } = renderHook(() => useVisibleTabs(feeds))
    expect(result.current.visibleTabs).toEqual([
      'for-you', 'trending', 'latest', 'politics', 'world', 'technology',
    ])
  })

  it('filters out tabs not in visibleFeeds', () => {
    const { result } = renderHook(() => useVisibleTabs(['trending', 'technology']))
    expect(result.current.visibleTabs).toEqual(['trending', 'technology'])
  })

  it('respects canonical order even if visibleFeeds is unordered', () => {
    const { result } = renderHook(() => useVisibleTabs(['world', 'for-you', 'politics', 'latest']))
    expect(result.current.visibleTabs).toEqual(['for-you', 'latest', 'politics', 'world'])
  })

  it('falls back to defaults if visibleFeeds is empty', () => {
    const { result } = renderHook(() => useVisibleTabs([]))
    expect(result.current.visibleTabs.length).toBeGreaterThan(0)
  })
})
