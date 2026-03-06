/**
 * Tests for lib/api/bias-calculator.ts
 */

import { describe, it, expect } from 'vitest'
import { computeBiasProfile } from '@/lib/api/bias-calculator'

describe('computeBiasProfile', () => {
  it('returns zero distribution when no stories read', () => {
    const profile = computeBiasProfile([], [])
    expect(profile.totalStoriesRead).toBe(0)
    expect(profile.dominantBias).toBeNull()
    expect(profile.blindspots).toEqual([])
    expect(profile.userDistribution.every((d) => d.percentage === 0)).toBe(true)
  })

  it('computes correct distribution from single story', () => {
    const userStories = [
      {
        spectrum_segments: [
          { bias: 'left' as const, percentage: 60 },
          { bias: 'center' as const, percentage: 40 },
        ],
      },
    ]

    const profile = computeBiasProfile(userStories, userStories)

    expect(profile.totalStoriesRead).toBe(1)
    expect(profile.dominantBias).toBe('left')

    const leftDist = profile.userDistribution.find((d) => d.bias === 'left')
    const centerDist = profile.userDistribution.find((d) => d.bias === 'center')
    expect(leftDist?.percentage).toBe(60)
    expect(centerDist?.percentage).toBe(40)
  })

  it('aggregates distribution from multiple stories', () => {
    const userStories = [
      {
        spectrum_segments: [
          { bias: 'left' as const, percentage: 100 },
        ],
      },
      {
        spectrum_segments: [
          { bias: 'right' as const, percentage: 100 },
        ],
      },
    ]

    const profile = computeBiasProfile(userStories, userStories)

    const leftDist = profile.userDistribution.find((d) => d.bias === 'left')
    const rightDist = profile.userDistribution.find((d) => d.bias === 'right')
    expect(leftDist?.percentage).toBe(50)
    expect(rightDist?.percentage).toBe(50)
  })

  it('identifies blindspots correctly', () => {
    const userStories = [
      {
        spectrum_segments: [
          { bias: 'left' as const, percentage: 100 },
        ],
      },
    ]

    const allStories = [
      {
        spectrum_segments: [
          { bias: 'left' as const, percentage: 50 },
          { bias: 'right' as const, percentage: 50 },
        ],
      },
    ]

    const profile = computeBiasProfile(userStories, allStories)

    // User reads 0% right but overall is 50% right → blindspot
    expect(profile.blindspots).toContain('right')
    // User reads 100% left, overall is 50% left → not a blindspot
    expect(profile.blindspots).not.toContain('left')
  })

  it('does not flag blindspots for small overall categories', () => {
    const userStories = [
      {
        spectrum_segments: [
          { bias: 'center' as const, percentage: 100 },
        ],
      },
    ]

    const allStories = [
      {
        spectrum_segments: [
          { bias: 'center' as const, percentage: 96 },
          { bias: 'far-left' as const, percentage: 4 },
        ],
      },
    ]

    const profile = computeBiasProfile(userStories, allStories)

    // far-left is only 4% overall (below 5% threshold) → not a blindspot
    expect(profile.blindspots).not.toContain('far-left')
  })

  it('returns all seven bias categories in distribution', () => {
    const profile = computeBiasProfile([], [])
    expect(profile.userDistribution).toHaveLength(7)
    expect(profile.overallDistribution).toHaveLength(7)

    const biases = profile.userDistribution.map((d) => d.bias)
    expect(biases).toContain('far-left')
    expect(biases).toContain('left')
    expect(biases).toContain('lean-left')
    expect(biases).toContain('center')
    expect(biases).toContain('lean-right')
    expect(biases).toContain('right')
    expect(biases).toContain('far-right')
  })

  it('handles stories with missing spectrum_segments', () => {
    const stories = [
      { spectrum_segments: null },
      { spectrum_segments: [{ bias: 'center' as const, percentage: 100 }] },
    ]

    const profile = computeBiasProfile(stories, stories)
    expect(profile.totalStoriesRead).toBe(2)

    const centerDist = profile.userDistribution.find((d) => d.bias === 'center')
    expect(centerDist?.percentage).toBe(100)
  })

  it('percentages sum to approximately 100', () => {
    const stories = [
      {
        spectrum_segments: [
          { bias: 'far-left' as const, percentage: 10 },
          { bias: 'left' as const, percentage: 20 },
          { bias: 'lean-left' as const, percentage: 15 },
          { bias: 'center' as const, percentage: 20 },
          { bias: 'lean-right' as const, percentage: 15 },
          { bias: 'right' as const, percentage: 15 },
          { bias: 'far-right' as const, percentage: 5 },
        ],
      },
    ]

    const profile = computeBiasProfile(stories, stories)
    const total = profile.userDistribution.reduce((sum, d) => sum + d.percentage, 0)
    // Allow for rounding (Math.round on each bucket)
    expect(total).toBeGreaterThanOrEqual(97)
    expect(total).toBeLessThanOrEqual(103)
  })
})
