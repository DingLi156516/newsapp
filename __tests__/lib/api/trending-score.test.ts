/**
 * Tests for lib/api/trending-score.ts
 *
 * The trending score is a composite:
 *   trending = impact × (1 + log10(max(articles_24h, 1))) × diversity × time_decay
 *   time_decay = 1 / (hours_since_published + 2) ^ gravity
 *
 * Tests cover the pure maths in isolation and verify ordering for known cases.
 */

import { describe, it, expect } from 'vitest'
import type { SpectrumSegment } from '@/lib/types'
import {
  computeTrendingScore,
  shannonDiversityFactor,
  rankByTrendingScore,
  type TrendingInputs,
} from '@/lib/api/trending-score'

const NOW = new Date('2026-04-16T12:00:00Z')

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000)
}

function inputs(overrides: Partial<TrendingInputs>): TrendingInputs {
  return {
    impactScore: 50,
    articles24h: 4,
    spectrumSegments: [
      { bias: 'left', percentage: 50 },
      { bias: 'right', percentage: 50 },
    ],
    publishedAt: hoursAgo(4).toISOString(),
    now: NOW,
    ...overrides,
  }
}

describe('shannonDiversityFactor', () => {
  it('returns 1 for a perfectly balanced two-bucket distribution', () => {
    const segments: SpectrumSegment[] = [
      { bias: 'left', percentage: 50 },
      { bias: 'right', percentage: 50 },
    ]
    expect(shannonDiversityFactor(segments)).toBeCloseTo(1, 3)
  })

  it('returns the 0.5 neutral floor for a single-bucket (echo chamber) distribution', () => {
    const segments: SpectrumSegment[] = [{ bias: 'center', percentage: 100 }]
    expect(shannonDiversityFactor(segments)).toBeCloseTo(0.5, 3)
  })

  it('rewards a seven-way balanced split with factor 1', () => {
    const even = 100 / 7
    const segments: SpectrumSegment[] = [
      { bias: 'far-left', percentage: even },
      { bias: 'left', percentage: even },
      { bias: 'lean-left', percentage: even },
      { bias: 'center', percentage: even },
      { bias: 'lean-right', percentage: even },
      { bias: 'right', percentage: even },
      { bias: 'far-right', percentage: even },
    ]
    expect(shannonDiversityFactor(segments)).toBeCloseTo(1, 3)
  })

  it('is higher for balanced than lopsided coverage', () => {
    const balanced: SpectrumSegment[] = [
      { bias: 'left', percentage: 50 },
      { bias: 'right', percentage: 50 },
    ]
    const lopsided: SpectrumSegment[] = [
      { bias: 'left', percentage: 90 },
      { bias: 'right', percentage: 10 },
    ]
    expect(shannonDiversityFactor(balanced)).toBeGreaterThan(
      shannonDiversityFactor(lopsided)
    )
  })

  it('returns 0.5 as a neutral default for empty/missing segments', () => {
    expect(shannonDiversityFactor([])).toBe(0.5)
  })

  it('ignores zero-percentage segments', () => {
    const segments: SpectrumSegment[] = [
      { bias: 'left', percentage: 50 },
      { bias: 'center', percentage: 0 },
      { bias: 'right', percentage: 50 },
    ]
    expect(shannonDiversityFactor(segments)).toBeCloseTo(1, 3)
  })
})

describe('computeTrendingScore', () => {
  it('produces a positive finite score for normal inputs', () => {
    const score = computeTrendingScore(inputs({}))
    expect(score).toBeGreaterThan(0)
    expect(Number.isFinite(score)).toBe(true)
  })

  it('returns 0 when impactScore is 0', () => {
    expect(computeTrendingScore(inputs({ impactScore: 0 }))).toBe(0)
  })

  it('treats articles24h of 0 as if it were 1 (no negative log)', () => {
    const zero = computeTrendingScore(inputs({ articles24h: 0 }))
    const one = computeTrendingScore(inputs({ articles24h: 1 }))
    expect(zero).toBe(one)
  })

  it('is higher for higher velocity', () => {
    const low = computeTrendingScore(inputs({ articles24h: 1 }))
    const high = computeTrendingScore(inputs({ articles24h: 50 }))
    expect(high).toBeGreaterThan(low)
  })

  it('is higher for more recent stories (time decay)', () => {
    const fresh = computeTrendingScore(inputs({ publishedAt: hoursAgo(1).toISOString() }))
    const old = computeTrendingScore(inputs({ publishedAt: hoursAgo(48).toISOString() }))
    expect(fresh).toBeGreaterThan(old)
  })

  it('ranks a 6h-old high-velocity story above a 10-min-old single-source story', () => {
    const highMomentum = computeTrendingScore({
      impactScore: 80,
      articles24h: 20,
      spectrumSegments: [
        { bias: 'left', percentage: 50 },
        { bias: 'right', percentage: 50 },
      ],
      publishedAt: hoursAgo(6).toISOString(),
      now: NOW,
    })
    const freshSingleSource = computeTrendingScore({
      impactScore: 20,
      articles24h: 1,
      spectrumSegments: [{ bias: 'center', percentage: 100 }],
      publishedAt: new Date(NOW.getTime() - 10 * 60 * 1000).toISOString(),
      now: NOW,
    })
    expect(highMomentum).toBeGreaterThan(freshSingleSource)
  })

  it('prefers balanced coverage over echo chambers with equal other signals', () => {
    const balanced = computeTrendingScore(
      inputs({
        spectrumSegments: [
          { bias: 'left', percentage: 50 },
          { bias: 'right', percentage: 50 },
        ],
      })
    )
    const lopsided = computeTrendingScore(
      inputs({
        spectrumSegments: [{ bias: 'center', percentage: 100 }],
      })
    )
    expect(balanced).toBeGreaterThan(lopsided)
  })

  it('decays with HN-like ~12h half-life (gravity 1.5)', () => {
    const at0 = computeTrendingScore(inputs({ publishedAt: hoursAgo(0).toISOString() }))
    const at12 = computeTrendingScore(inputs({ publishedAt: hoursAgo(12).toISOString() }))
    // (0+2)^1.5 / (12+2)^1.5 ≈ 0.054 — so 12h-old score should be much smaller
    expect(at12 / at0).toBeLessThan(0.2)
    expect(at12 / at0).toBeGreaterThan(0)
  })

  it('respects a custom gravity override', () => {
    const gentle = computeTrendingScore(
      inputs({ publishedAt: hoursAgo(24).toISOString(), gravity: 0.8 })
    )
    const aggressive = computeTrendingScore(
      inputs({ publishedAt: hoursAgo(24).toISOString(), gravity: 2.0 })
    )
    expect(gentle).toBeGreaterThan(aggressive)
  })

  it('is robust to a future-dated publishedAt (treats as now)', () => {
    const future = computeTrendingScore(
      inputs({ publishedAt: new Date(NOW.getTime() + 60_000).toISOString() })
    )
    expect(Number.isFinite(future)).toBe(true)
    expect(future).toBeGreaterThan(0)
  })
})

describe('rankByTrendingScore', () => {
  interface StoryLike {
    id: string
    impactScore: number
    articles24h: number
    spectrumSegments: SpectrumSegment[]
    publishedAt: string
  }

  const balanced: SpectrumSegment[] = [
    { bias: 'left', percentage: 50 },
    { bias: 'right', percentage: 50 },
  ]

  it('orders stories by descending trending score', () => {
    const stories: StoryLike[] = [
      {
        id: 'a-low',
        impactScore: 5,
        articles24h: 1,
        spectrumSegments: balanced,
        publishedAt: hoursAgo(30).toISOString(),
      },
      {
        id: 'b-momentum',
        impactScore: 90,
        articles24h: 50,
        spectrumSegments: balanced,
        publishedAt: hoursAgo(3).toISOString(),
      },
      {
        id: 'c-fresh',
        impactScore: 30,
        articles24h: 2,
        spectrumSegments: balanced,
        publishedAt: new Date(NOW.getTime() - 30 * 60 * 1000).toISOString(),
      },
    ]

    const ranked = rankByTrendingScore(stories, NOW)
    expect(ranked.map((s) => s.id)).toEqual(['b-momentum', 'c-fresh', 'a-low'])
  })

  it('is pure — returns a new array without mutating the input', () => {
    const stories: StoryLike[] = [
      {
        id: 'one',
        impactScore: 10,
        articles24h: 1,
        spectrumSegments: balanced,
        publishedAt: hoursAgo(10).toISOString(),
      },
      {
        id: 'two',
        impactScore: 70,
        articles24h: 10,
        spectrumSegments: balanced,
        publishedAt: hoursAgo(2).toISOString(),
      },
    ]
    const snapshot = stories.map((s) => s.id)
    const ranked = rankByTrendingScore(stories, NOW)
    expect(stories.map((s) => s.id)).toEqual(snapshot)
    expect(ranked).not.toBe(stories)
  })
})
