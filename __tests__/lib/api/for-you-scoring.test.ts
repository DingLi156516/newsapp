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
