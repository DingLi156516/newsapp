import { computeOwnershipDistribution } from '@/lib/shared/ownership-aggregator'
import type { MediaOwner, NewsSource } from '@/lib/shared/types'

function makeOwner(id: string, name: string, extra: Partial<MediaOwner> = {}): MediaOwner {
  return {
    id,
    name,
    slug: id,
    ownerType: 'public_company',
    isIndividual: false,
    country: 'US',
    wikidataQid: null,
    ownerSource: 'manual',
    ownerVerifiedAt: '2026-01-01T00:00:00Z',
    ...extra,
  }
}

function makeSource(id: string, owner?: MediaOwner): NewsSource {
  return {
    id,
    name: `Source ${id}`,
    bias: 'center',
    factuality: 'high',
    ownership: 'corporate',
    owner,
  }
}

describe('computeOwnershipDistribution (mobile)', () => {
  it('returns zeroed distribution for empty sources', () => {
    const result = computeOwnershipDistribution([])
    expect(result.groups).toEqual([])
    expect(result.unknownCount).toBe(0)
    expect(result.dominantOwner).toBeNull()
  })

  it('flags a dominant owner when share >= 50% of total sources', () => {
    const a = makeOwner('a', 'A Corp')
    const sources = [
      makeSource('1', a),
      makeSource('2', a),
      makeSource('3', a),
      makeSource('4'),
    ]
    const result = computeOwnershipDistribution(sources)
    expect(result.dominantOwner?.ownerId).toBe('a')
    expect(result.groups[0].percentage).toBe(75)
    expect(result.unknownCount).toBe(1)
  })

  it('does not flag a dominant owner when top share is under 50%', () => {
    const a = makeOwner('a', 'A')
    const b = makeOwner('b', 'B')
    const c = makeOwner('c', 'C')
    const sources = [
      makeSource('1', a),
      makeSource('2', b),
      makeSource('3', c),
    ]
    const result = computeOwnershipDistribution(sources)
    expect(result.dominantOwner).toBeNull()
  })

  it('does NOT flag dominance at 99/200 (49.5% rounds up for display but count fails threshold)', () => {
    const a = makeOwner('a', 'A')
    const b = makeOwner('b', 'B')
    const sources: NewsSource[] = [
      ...Array.from({ length: 99 }, (_, i) => makeSource(`a-${i}`, a)),
      ...Array.from({ length: 99 }, (_, i) => makeSource(`b-${i}`, b)),
      makeSource('u1'),
      makeSource('u2'),
    ]
    const result = computeOwnershipDistribution(sources)
    expect(result.dominantOwner).toBeNull()
  })

  it('flags dominance at the 50/50 boundary using raw counts', () => {
    const a = makeOwner('a', 'A')
    const sources: NewsSource[] = [
      ...Array.from({ length: 100 }, (_, i) => makeSource(`a-${i}`, a)),
      ...Array.from({ length: 100 }, (_, i) => makeSource(`u-${i}`)),
    ]
    const result = computeOwnershipDistribution(sources)
    expect(result.dominantOwner?.ownerId).toBe('a')
  })

  it('produces concentrationIndex of 1 for single-owner, unmixed distribution', () => {
    const a = makeOwner('a', 'A')
    const result = computeOwnershipDistribution([makeSource('1', a), makeSource('2', a)])
    expect(result.concentrationIndex).toBeCloseTo(1, 2)
  })
})
