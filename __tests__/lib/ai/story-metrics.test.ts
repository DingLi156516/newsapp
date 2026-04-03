import {
  computeStoryVelocity,
  computeSourceDiversity,
  computeImpactScore,
  computeControversyScore,
  computeCoverageDurationHours,
} from '@/lib/ai/story-metrics'

describe('computeStoryVelocity', () => {
  const now = new Date('2024-06-15T12:00:00Z')

  it('returns breaking phase for 3+ articles in 24h on a new story', () => {
    const articles = [
      { published_at: '2024-06-15T10:00:00Z' },
      { published_at: '2024-06-15T09:00:00Z' },
      { published_at: '2024-06-15T08:00:00Z' },
    ]
    const result = computeStoryVelocity(articles, '2024-06-15T07:00:00Z', now)
    expect(result.phase).toBe('breaking')
    expect(result.articles_24h).toBe(3)
  })

  it('returns developing phase for active story under 7 days', () => {
    const articles = [
      { published_at: '2024-06-15T10:00:00Z' },
      { published_at: '2024-06-13T10:00:00Z' },
    ]
    const result = computeStoryVelocity(articles, '2024-06-12T00:00:00Z', now)
    expect(result.phase).toBe('developing')
    expect(result.articles_24h).toBe(1)
  })

  it('returns analysis phase for older story with recent coverage', () => {
    const articles = [
      { published_at: '2024-06-12T10:00:00Z' },
      { published_at: '2024-06-11T10:00:00Z' },
    ]
    const result = computeStoryVelocity(articles, '2024-06-01T00:00:00Z', now)
    expect(result.phase).toBe('analysis')
    expect(result.articles_24h).toBe(0)
    expect(result.articles_7d).toBe(2)
  })

  it('returns aftermath phase for inactive story', () => {
    const articles = [
      { published_at: '2024-06-01T10:00:00Z' },
    ]
    const result = computeStoryVelocity(articles, '2024-05-20T00:00:00Z', now)
    expect(result.phase).toBe('aftermath')
    expect(result.articles_7d).toBe(0)
  })

  it('counts articles in all time windows correctly', () => {
    const articles = [
      { published_at: '2024-06-15T11:00:00Z' }, // 24h
      { published_at: '2024-06-14T11:00:00Z' }, // 48h
      { published_at: '2024-06-10T11:00:00Z' }, // 7d
      { published_at: '2024-06-01T11:00:00Z' }, // outside 7d
    ]
    const result = computeStoryVelocity(articles, '2024-05-30T00:00:00Z', now)
    expect(result.articles_24h).toBe(1)
    expect(result.articles_48h).toBe(2)
    expect(result.articles_7d).toBe(3)
  })
})

describe('computeSourceDiversity', () => {
  it('counts unique ownership types', () => {
    expect(computeSourceDiversity(['corporate', 'independent', 'corporate', 'non-profit'])).toBe(3)
  })

  it('returns 0 for empty array', () => {
    expect(computeSourceDiversity([])).toBe(0)
  })

  it('returns 1 for all same type', () => {
    expect(computeSourceDiversity(['corporate', 'corporate'])).toBe(1)
  })
})

describe('computeImpactScore', () => {
  it('returns 0 for minimal values', () => {
    expect(computeImpactScore(0, 0, 0, 0)).toBe(0)
  })

  it('returns 100 for maximum values', () => {
    expect(computeImpactScore(20, 10, 168, 6)).toBe(100)
  })

  it('returns intermediate values proportionally', () => {
    const score = computeImpactScore(10, 5, 84, 3)
    expect(score).toBeGreaterThan(30)
    expect(score).toBeLessThan(80)
  })

  it('caps values above thresholds', () => {
    const capped = computeImpactScore(100, 50, 500, 20)
    expect(capped).toBe(100)
  })
})

describe('computeControversyScore', () => {
  it('returns 0 for empty summaries', () => {
    const score = computeControversyScore({
      commonGround: '',
      leftFraming: '',
      rightFraming: '',
    })
    expect(score).toBe(0)
  })

  it('returns 0 for identical framing', () => {
    const score = computeControversyScore({
      commonGround: 'same facts',
      leftFraming: 'both sides agree on this point',
      rightFraming: 'both sides agree on this point',
    })
    expect(score).toBe(0)
  })

  it('returns high score for divergent framing', () => {
    const score = computeControversyScore({
      commonGround: 'the bill was introduced',
      leftFraming: 'progressive reform protects vulnerable communities',
      rightFraming: 'government overreach destroys small business freedom',
    })
    expect(score).toBeGreaterThan(0.5)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('returns value between 0 and 1', () => {
    const score = computeControversyScore({
      commonGround: 'facts',
      leftFraming: 'some different words here about policy',
      rightFraming: 'completely other terminology regarding legislation',
    })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('captures short politically significant words (tax, war, gun)', () => {
    const score = computeControversyScore({
      commonGround: 'the debate continues',
      leftFraming: 'gun control tax reform war policy',
      rightFraming: 'freedom liberty rights amendment',
    })
    expect(score).toBeGreaterThan(0)
  })
})

describe('computeCoverageDurationHours', () => {
  it('returns 0 for fewer than 2 articles', () => {
    expect(computeCoverageDurationHours([])).toBe(0)
    expect(computeCoverageDurationHours([{ published_at: '2024-06-15T10:00:00Z' }])).toBe(0)
  })

  it('returns correct duration in hours', () => {
    const articles = [
      { published_at: '2024-06-15T10:00:00Z' },
      { published_at: '2024-06-15T16:00:00Z' },
    ]
    expect(computeCoverageDurationHours(articles)).toBe(6)
  })

  it('handles articles in any order', () => {
    const articles = [
      { published_at: '2024-06-15T16:00:00Z' },
      { published_at: '2024-06-15T10:00:00Z' },
      { published_at: '2024-06-15T13:00:00Z' },
    ]
    expect(computeCoverageDurationHours(articles)).toBe(6)
  })
})
