/**
 * Tests for lib/api/for-you-scoring.ts
 */

import { describe, it, expect } from 'vitest'
import { scoreStory, rankStoriesForUser } from '@/lib/api/for-you-scoring'
import type { ForYouSignals } from '@/lib/api/for-you-scoring'

const baseStory = {
  id: 'story-1',
  headline: 'Test Story',
  topic: 'politics',
  timestamp: new Date().toISOString(),
  spectrumSegments: [
    { bias: 'left', percentage: 50 },
    { bias: 'right', percentage: 50 },
  ],
}

const emptySignals: ForYouSignals = {
  followedTopics: [],
  blindspotCategories: [],
  readStoryIds: new Set(),
  now: new Date(),
}

describe('scoreStory', () => {
  it('returns 0 for a story with no matching signals except recency/unread', () => {
    const oldStory = {
      ...baseStory,
      timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    }
    const signals: ForYouSignals = {
      ...emptySignals,
      readStoryIds: new Set(['story-1']),
    }
    const score = scoreStory(oldStory, signals)
    expect(score).toBe(0)
  })

  it('adds 40 points for topic match', () => {
    const oldStory = {
      ...baseStory,
      timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    }
    const signals: ForYouSignals = {
      ...emptySignals,
      followedTopics: ['politics'],
      readStoryIds: new Set(['story-1']),
    }
    const score = scoreStory(oldStory, signals)
    expect(score).toBe(40)
  })

  it('adds 30 points for high blindspot overlap (≥30%)', () => {
    const story = {
      ...baseStory,
      timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      spectrumSegments: [{ bias: 'far-right', percentage: 35 }],
    }
    const signals: ForYouSignals = {
      ...emptySignals,
      blindspotCategories: ['far-right'],
      readStoryIds: new Set(['story-1']),
    }
    const score = scoreStory(story, signals)
    expect(score).toBe(30)
  })

  it('adds 15 points for medium blindspot overlap (≥15%, <30%)', () => {
    const story = {
      ...baseStory,
      timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      spectrumSegments: [{ bias: 'far-right', percentage: 20 }],
    }
    const signals: ForYouSignals = {
      ...emptySignals,
      blindspotCategories: ['far-right'],
      readStoryIds: new Set(['story-1']),
    }
    const score = scoreStory(story, signals)
    expect(score).toBe(15)
  })

  it('adds 0 points for low blindspot overlap (<15%)', () => {
    const story = {
      ...baseStory,
      timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      spectrumSegments: [{ bias: 'far-right', percentage: 10 }],
    }
    const signals: ForYouSignals = {
      ...emptySignals,
      blindspotCategories: ['far-right'],
      readStoryIds: new Set(['story-1']),
    }
    const score = scoreStory(story, signals)
    expect(score).toBe(0)
  })

  it('adds 20 points for a brand-new story (recency)', () => {
    const now = new Date()
    const story = {
      ...baseStory,
      timestamp: now.toISOString(),
    }
    const signals: ForYouSignals = {
      ...emptySignals,
      readStoryIds: new Set(['story-1']),
      now,
    }
    const score = scoreStory(story, signals)
    expect(score).toBe(20)
  })

  it('decays recency linearly over 48h', () => {
    const now = new Date()
    const story24hAgo = {
      ...baseStory,
      timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    }
    const signals: ForYouSignals = {
      ...emptySignals,
      readStoryIds: new Set(['story-1']),
      now,
    }
    const score = scoreStory(story24hAgo, signals)
    // 24h is halfway through 48h decay → ~10 points
    expect(score).toBe(10)
  })

  it('returns 0 recency for stories older than 48h', () => {
    const now = new Date()
    const oldStory = {
      ...baseStory,
      timestamp: new Date(now.getTime() - 49 * 60 * 60 * 1000).toISOString(),
    }
    const signals: ForYouSignals = {
      ...emptySignals,
      readStoryIds: new Set(['story-1']),
      now,
    }
    const score = scoreStory(oldStory, signals)
    expect(score).toBe(0)
  })

  it('adds 10 points for unread bonus', () => {
    const story = {
      ...baseStory,
      timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    }
    const signals: ForYouSignals = {
      ...emptySignals,
      readStoryIds: new Set(),
    }
    const score = scoreStory(story, signals)
    expect(score).toBe(10)
  })

  it('computes max score of 100 with all signals', () => {
    const now = new Date()
    const story = {
      ...baseStory,
      topic: 'politics',
      timestamp: now.toISOString(),
      spectrumSegments: [{ bias: 'far-right', percentage: 40 }],
    }
    const signals: ForYouSignals = {
      followedTopics: ['politics'],
      blindspotCategories: ['far-right'],
      readStoryIds: new Set(),
      now,
    }
    const score = scoreStory(story, signals)
    // 40 (topic) + 30 (blindspot) + 20 (recency) + 10 (unread) = 100
    expect(score).toBe(100)
  })

  it('handles empty spectrum segments', () => {
    const story = {
      ...baseStory,
      timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      spectrumSegments: [],
    }
    const signals: ForYouSignals = {
      ...emptySignals,
      blindspotCategories: ['far-right'],
      readStoryIds: new Set(['story-1']),
    }
    const score = scoreStory(story, signals)
    expect(score).toBe(0)
  })

  it('adds 15 points when topic+region matches a recent read-through', () => {
    // Candidate is a *different* unread story than the one that
    // generated the read-similar signal — so the self-match guard
    // doesn't fire and the bonus is awarded.
    const story = {
      ...baseStory,
      id: 'fresh-similar',
      topic: 'politics',
      region: 'us',
      timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    }
    const signals: ForYouSignals = {
      ...emptySignals,
      readStoryIds: new Set(['previously-read']),
      readSimilarSignals: [{ topic: 'politics', region: 'us' }],
    }
    // 0 (recency expired) + 10 (unread) + 15 (read-similar) = 25
    expect(scoreStory(story, signals)).toBe(25)
  })

  it('does not award the read-similar bonus when only topic matches', () => {
    // Use an unread story id so this test exercises the topic+region
    // gate, not the new "skip already-read" self-match guard.
    const story = {
      ...baseStory,
      id: 'unread-eu',
      topic: 'politics',
      region: 'eu',
      timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    }
    const signals: ForYouSignals = {
      ...emptySignals,
      readStoryIds: new Set(['previously-read']),
      readSimilarSignals: [{ topic: 'politics', region: 'us' }],
    }
    // 0 (recency expired) + 10 (unread) + 0 (region mismatch) = 10
    expect(scoreStory(story, signals)).toBe(10)
  })

  it('does not award the read-similar bonus to a story the user has already read', () => {
    const story = {
      ...baseStory,
      id: 'already-read',
      topic: 'politics',
      region: 'us',
      timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    }
    const signals: ForYouSignals = {
      ...emptySignals,
      readStoryIds: new Set(['already-read']),
      readSimilarSignals: [{ topic: 'politics', region: 'us' }],
    }
    // No unread bonus (already read), and no read-similar bonus either —
    // would otherwise let a finished-read story self-match its own signal
    // and outrank fresh content.
    expect(scoreStory(story, signals)).toBe(0)
  })

  it('does not award the read-similar bonus when story has no region', () => {
    // Use an unread id so the assertion isolates the missing-region
    // condition rather than the self-match guard.
    const story = {
      ...baseStory,
      id: 'unread-no-region',
      topic: 'politics',
      timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    }
    const signals: ForYouSignals = {
      ...emptySignals,
      readStoryIds: new Set(['previously-read']),
      readSimilarSignals: [{ topic: 'politics', region: 'us' }],
    }
    // 0 (recency) + 10 (unread) + 0 (no region) = 10
    expect(scoreStory(story, signals)).toBe(10)
  })

  it('max score becomes 115 with all signals + read-similar bonus', () => {
    const now = new Date()
    const story = {
      ...baseStory,
      topic: 'politics',
      region: 'us',
      timestamp: now.toISOString(),
      spectrumSegments: [{ bias: 'far-right', percentage: 40 }],
    }
    const signals: ForYouSignals = {
      followedTopics: ['politics'],
      blindspotCategories: ['far-right'],
      readStoryIds: new Set(),
      readSimilarSignals: [{ topic: 'politics', region: 'us' }],
      now,
    }
    expect(scoreStory(story, signals)).toBe(115)
  })
})

describe('rankStoriesForUser', () => {
  it('sorts stories by score descending', () => {
    const now = new Date()
    const stories = [
      {
        ...baseStory,
        id: 'low',
        topic: 'sports',
        timestamp: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(),
        spectrumSegments: [],
      },
      {
        ...baseStory,
        id: 'high',
        topic: 'politics',
        timestamp: now.toISOString(),
        spectrumSegments: [{ bias: 'far-right', percentage: 40 }],
      },
    ]
    const signals: ForYouSignals = {
      followedTopics: ['politics'],
      blindspotCategories: ['far-right'],
      readStoryIds: new Set(['low']),
      now,
    }

    const ranked = rankStoriesForUser(stories, signals)
    expect(ranked[0].id).toBe('high')
    expect(ranked[1].id).toBe('low')
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score)
  })

  it('returns empty array for empty input', () => {
    const ranked = rankStoriesForUser([], emptySignals)
    expect(ranked).toEqual([])
  })

  it('preserves all story properties in output', () => {
    const story = { ...baseStory, customField: 'custom' }
    const ranked = rankStoriesForUser([story], emptySignals)
    expect(ranked[0].headline).toBe('Test Story')
    expect(ranked[0]).toHaveProperty('score')
  })

  it('includes score property on each result', () => {
    const ranked = rankStoriesForUser([baseStory], emptySignals)
    expect(typeof ranked[0].score).toBe('number')
  })
})
