import { buildSourceComparison } from '@/lib/source-comparison'
import type { SourceProfile } from '@/lib/types'

function makeProfile(overrides: Partial<SourceProfile> & { source?: Partial<SourceProfile['source']> } = {}): SourceProfile {
  return {
    source: {
      id: overrides.source?.id ?? 'src-1',
      slug: overrides.source?.slug ?? 'reuters',
      name: overrides.source?.name ?? 'Reuters',
      bias: overrides.source?.bias ?? 'center',
      factuality: overrides.source?.factuality ?? 'very-high',
      ownership: overrides.source?.ownership ?? 'corporate',
      region: overrides.source?.region ?? 'international',
      isActive: overrides.source?.isActive ?? true,
      url: overrides.source?.url ?? 'reuters.com',
    },
    recentStories: overrides.recentStories ?? [],
    topicBreakdown: overrides.topicBreakdown ?? [],
    blindspotCount: overrides.blindspotCount ?? 0,
  }
}

describe('buildSourceComparison', () => {
  it('computes shared and exclusive stories with newest-first ordering', () => {
    const left = makeProfile({
      recentStories: [
        {
          id: 'story-1',
          headline: 'Shared Story',
          topic: 'politics',
          region: 'us',
          timestamp: '2026-03-03T10:00:00Z',
          isBlindspot: false,
        },
        {
          id: 'story-2',
          headline: 'Left Exclusive',
          topic: 'technology',
          region: 'us',
          timestamp: '2026-03-04T09:00:00Z',
          isBlindspot: false,
        },
      ],
      blindspotCount: 1,
    })

    const right = makeProfile({
      source: { id: 'src-2', slug: 'fox-news', name: 'Fox News', bias: 'right', factuality: 'mixed', ownership: 'corporate', region: 'us', isActive: true },
      recentStories: [
        {
          id: 'story-3',
          headline: 'Right Exclusive',
          topic: 'world',
          region: 'international',
          timestamp: '2026-03-05T09:00:00Z',
          isBlindspot: true,
        },
        {
          id: 'story-1',
          headline: 'Shared Story',
          topic: 'politics',
          region: 'us',
          timestamp: '2026-03-03T10:00:00Z',
          isBlindspot: false,
        },
      ],
      blindspotCount: 2,
    })

    const result = buildSourceComparison(left, right)

    expect(result.sharedStories).toHaveLength(1)
    expect(result.sharedStories[0].id).toBe('story-1')
    expect(result.leftExclusiveStories.map((story) => story.id)).toEqual(['story-2'])
    expect(result.rightExclusiveStories.map((story) => story.id)).toEqual(['story-3'])
    expect(result.stats.sharedStoryCount).toBe(1)
    expect(result.stats.leftExclusiveCount).toBe(1)
    expect(result.stats.rightExclusiveCount).toBe(1)
    expect(result.stats.leftBlindspotCount).toBe(1)
    expect(result.stats.rightBlindspotCount).toBe(2)
  })

  it('derives topic overlap and topic imbalances', () => {
    const left = makeProfile({
      recentStories: [
        {
          id: 'story-1',
          headline: 'Story One',
          topic: 'politics',
          region: 'us',
          timestamp: '2026-03-03T10:00:00Z',
          isBlindspot: false,
        },
        {
          id: 'story-2',
          headline: 'Story Two',
          topic: 'politics',
          region: 'us',
          timestamp: '2026-03-02T10:00:00Z',
          isBlindspot: false,
        },
        {
          id: 'story-3',
          headline: 'Story Three',
          topic: 'technology',
          region: 'us',
          timestamp: '2026-03-01T10:00:00Z',
          isBlindspot: false,
        },
      ],
    })

    const right = makeProfile({
      source: { id: 'src-2', slug: 'wsj', name: 'Wall Street Journal', bias: 'lean-right', factuality: 'high', ownership: 'corporate', region: 'us', isActive: true },
      recentStories: [
        {
          id: 'story-4',
          headline: 'Story Four',
          topic: 'politics',
          region: 'us',
          timestamp: '2026-03-03T08:00:00Z',
          isBlindspot: false,
        },
        {
          id: 'story-5',
          headline: 'Story Five',
          topic: 'business',
          region: 'us',
          timestamp: '2026-03-01T08:00:00Z',
          isBlindspot: false,
        },
      ],
    })

    const result = buildSourceComparison(left, right)

    expect(result.stats.overlappingTopics).toEqual([
      { topic: 'politics', leftCount: 2, rightCount: 1 },
    ])
    expect(result.stats.topicImbalances).toEqual([
      { topic: 'technology', leftCount: 1, rightCount: 0 },
      { topic: 'business', leftCount: 0, rightCount: 1 },
    ])
  })
})
