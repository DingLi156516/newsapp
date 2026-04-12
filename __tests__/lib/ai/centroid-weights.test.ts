import { describe, it, expect } from 'vitest'
import {
  factualityWeight,
  timeDecayWeight,
  combinedWeight,
  FACTUALITY_WEIGHTS,
} from '@/lib/ai/centroid-weights'

describe('factualityWeight', () => {
  it('returns 1.5 for very-high factuality', () => {
    expect(factualityWeight('very-high')).toBe(1.5)
  })

  it('returns 1.25 for high factuality', () => {
    expect(factualityWeight('high')).toBe(1.25)
  })

  it('returns 1.0 for mixed factuality', () => {
    expect(factualityWeight('mixed')).toBe(1.0)
  })

  it('returns 0.75 for low factuality', () => {
    expect(factualityWeight('low')).toBe(0.75)
  })

  it('returns 0.5 for very-low factuality', () => {
    expect(factualityWeight('very-low')).toBe(0.5)
  })

  it('exposes the full weight table as a constant', () => {
    expect(FACTUALITY_WEIGHTS).toEqual({
      'very-high': 1.5,
      'high': 1.25,
      'mixed': 1.0,
      'low': 0.75,
      'very-low': 0.5,
    })
  })
})

describe('timeDecayWeight', () => {
  const now = new Date('2026-04-11T12:00:00Z')

  it('returns 1 when published time equals now', () => {
    expect(timeDecayWeight(now, now)).toBeCloseTo(1.0)
  })

  it('returns ~0.5 at the 24h half-life default', () => {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    expect(timeDecayWeight(yesterday, now)).toBeCloseTo(0.5, 5)
  })

  it('returns ~0.25 at 48h (two half-lives)', () => {
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)
    expect(timeDecayWeight(twoDaysAgo, now)).toBeCloseTo(0.25, 5)
  })

  it('returns ~0.125 at 72h (three half-lives)', () => {
    const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000)
    expect(timeDecayWeight(threeDaysAgo, now)).toBeCloseTo(0.125, 5)
  })

  it('clamps future publication times to weight 1 (ageMs floored at 0)', () => {
    const future = new Date(now.getTime() + 60 * 60 * 1000)
    expect(timeDecayWeight(future, now)).toBeCloseTo(1.0)
  })

  it('supports an explicit halfLifeMs override', () => {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneHourHalfLife = 60 * 60 * 1000
    expect(timeDecayWeight(oneHourAgo, now, oneHourHalfLife)).toBeCloseTo(0.5, 5)
  })

  it('is monotonically decreasing in age', () => {
    const t1 = new Date(now.getTime() - 1 * 60 * 60 * 1000)
    const t6 = new Date(now.getTime() - 6 * 60 * 60 * 1000)
    const t24 = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const t48 = new Date(now.getTime() - 48 * 60 * 60 * 1000)

    const w1 = timeDecayWeight(t1, now)
    const w6 = timeDecayWeight(t6, now)
    const w24 = timeDecayWeight(t24, now)
    const w48 = timeDecayWeight(t48, now)

    expect(w1).toBeGreaterThan(w6)
    expect(w6).toBeGreaterThan(w24)
    expect(w24).toBeGreaterThan(w48)
  })
})

describe('combinedWeight', () => {
  const now = new Date('2026-04-11T12:00:00Z')

  it('multiplies factuality and time-decay components', () => {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    // high (1.25) × 24h half-life (0.5) = 0.625
    expect(combinedWeight('high', yesterday, now)).toBeCloseTo(0.625, 5)
  })

  it('returns the pure factuality weight when published_at equals now', () => {
    expect(combinedWeight('very-high', now, now)).toBeCloseTo(1.5)
  })

  it('gives high-factuality recent articles ~6x the weight of low-factuality day-old ones', () => {
    const recent = new Date(now.getTime() - 60 * 1000) // 1 min ago
    const dayOld = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const wHigh = combinedWeight('very-high', recent, now) // ≈ 1.5
    const wLow = combinedWeight('very-low', dayOld, now)    // ≈ 0.5 × 0.5 = 0.25
    expect(wHigh / wLow).toBeGreaterThan(5)
  })
})
