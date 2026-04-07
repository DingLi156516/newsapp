import { aggregateRatings } from '@/lib/bias-ratings/aggregator'
import type { ProviderRating } from '@/lib/bias-ratings/types'

describe('aggregateRatings', () => {
  describe('bias aggregation', () => {
    it('returns null bias when no providers given', () => {
      const result = aggregateRatings([])
      expect(result.bias).toBeNull()
      expect(result.factuality).toBeNull()
      expect(result.providerCount).toBe(0)
    })

    it('uses single provider bias directly', () => {
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: 'lean-left', factuality: 'high' },
      ]
      const result = aggregateRatings(ratings)
      expect(result.bias).toBe('lean-left')
    })

    it('returns median when two providers agree', () => {
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: 'lean-left', factuality: null },
        { provider: 'allsides', bias: 'lean-left', factuality: null },
      ]
      const result = aggregateRatings(ratings)
      expect(result.bias).toBe('lean-left')
    })

    it('returns median when two providers are adjacent', () => {
      // lean-left (2) and center (3) → median = 2.5 → rounds to center (3)
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: 'lean-left', factuality: null },
        { provider: 'allsides', bias: 'center', factuality: null },
      ]
      const result = aggregateRatings(ratings)
      expect(result.bias).toBe('center')
    })

    it('returns median when two providers are one apart', () => {
      // left (1) and center (3) → median = 2 → lean-left
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: 'left', factuality: null },
        { provider: 'allsides', bias: 'center', factuality: null },
      ]
      const result = aggregateRatings(ratings)
      expect(result.bias).toBe('lean-left')
    })

    it('returns median of three providers', () => {
      // far-left (0), lean-left (2), center (3) → sorted: 0, 2, 3 → median = 2 → lean-left
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: 'far-left', factuality: null },
        { provider: 'allsides', bias: 'lean-left', factuality: null },
        { provider: 'adfm', bias: 'center', factuality: null },
      ]
      const result = aggregateRatings(ratings)
      expect(result.bias).toBe('lean-left')
    })

    it('handles three providers all agreeing', () => {
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: 'right', factuality: null },
        { provider: 'allsides', bias: 'right', factuality: null },
        { provider: 'adfm', bias: 'right', factuality: null },
      ]
      const result = aggregateRatings(ratings)
      expect(result.bias).toBe('right')
    })

    it('handles far-right consensus', () => {
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: 'far-right', factuality: null },
        { provider: 'allsides', bias: 'right', factuality: null },
      ]
      // far-right (6), right (5) → median = 5.5 → rounds to far-right (6)
      const result = aggregateRatings(ratings)
      expect(result.bias).toBe('far-right')
    })

    it('skips null bias values', () => {
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: 'center', factuality: null },
        { provider: 'allsides', bias: null, factuality: null },
      ]
      const result = aggregateRatings(ratings)
      expect(result.bias).toBe('center')
    })

    it('returns null when all bias values are null', () => {
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: null, factuality: 'high' },
        { provider: 'allsides', bias: null, factuality: null },
      ]
      const result = aggregateRatings(ratings)
      expect(result.bias).toBeNull()
    })

    it('resolves wide disagreement with median', () => {
      // far-left (0) and far-right (6) → median = 3 → center
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: 'far-left', factuality: null },
        { provider: 'allsides', bias: 'far-right', factuality: null },
      ]
      const result = aggregateRatings(ratings)
      expect(result.bias).toBe('center')
    })
  })

  describe('factuality aggregation', () => {
    it('uses single provider factuality directly', () => {
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: null, factuality: 'high' },
      ]
      const result = aggregateRatings(ratings)
      expect(result.factuality).toBe('high')
    })

    it('returns median when two providers agree', () => {
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: null, factuality: 'high' },
        { provider: 'allsides', bias: null, factuality: 'high' },
      ]
      const result = aggregateRatings(ratings)
      expect(result.factuality).toBe('high')
    })

    it('returns median when two providers are adjacent', () => {
      // mixed (2) and high (3) → median = 2.5 → rounds to high (3)
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: null, factuality: 'mixed' },
        { provider: 'allsides', bias: null, factuality: 'high' },
      ]
      const result = aggregateRatings(ratings)
      expect(result.factuality).toBe('high')
    })

    it('returns null when no factuality data', () => {
      const ratings: ProviderRating[] = [
        { provider: 'allsides', bias: 'left', factuality: null },
      ]
      const result = aggregateRatings(ratings)
      expect(result.factuality).toBeNull()
    })

    it('skips null factuality values', () => {
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: null, factuality: 'very-high' },
        { provider: 'allsides', bias: null, factuality: null },
      ]
      const result = aggregateRatings(ratings)
      expect(result.factuality).toBe('very-high')
    })

    it('handles three providers with factuality', () => {
      // low (1), mixed (2), very-high (4) → sorted: 1, 2, 4 → median = 2 → mixed
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: null, factuality: 'low' },
        { provider: 'allsides', bias: null, factuality: 'mixed' },
        { provider: 'adfm', bias: null, factuality: 'very-high' },
      ]
      const result = aggregateRatings(ratings)
      expect(result.factuality).toBe('mixed')
    })
  })

  describe('metadata', () => {
    it('tracks provider count', () => {
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: 'center', factuality: 'high' },
        { provider: 'allsides', bias: 'center', factuality: null },
      ]
      const result = aggregateRatings(ratings)
      expect(result.providerCount).toBe(2)
    })

    it('preserves original ratings', () => {
      const ratings: ProviderRating[] = [
        { provider: 'mbfc', bias: 'lean-left', factuality: 'high' },
      ]
      const result = aggregateRatings(ratings)
      expect(result.ratings).toEqual(ratings)
    })
  })
})
