/**
 * Tests for lib/api/ownership-aggregator.ts
 */

import { describe, it, expect } from 'vitest'
import { computeOwnershipDistribution } from '@/lib/api/ownership-aggregator'
import type { NewsSource, MediaOwner } from '@/lib/types'

function makeOwner(overrides: Partial<MediaOwner> & { id: string; name: string }): MediaOwner {
  return {
    id: overrides.id,
    name: overrides.name,
    slug: overrides.slug ?? overrides.id,
    ownerType: overrides.ownerType ?? 'public_company',
    isIndividual: overrides.isIndividual ?? false,
    country: overrides.country ?? 'US',
    wikidataQid: overrides.wikidataQid ?? null,
    ownerSource: overrides.ownerSource ?? 'manual',
    ownerVerifiedAt: overrides.ownerVerifiedAt ?? '2026-01-01T00:00:00Z',
  }
}

function makeSource(id: string, owner?: MediaOwner): NewsSource {
  return {
    id,
    name: `Source ${id}`,
    bias: 'center',
    factuality: 'high',
    ownership: 'corporate',
    region: 'us',
    owner,
  }
}

describe('computeOwnershipDistribution', () => {
  it('returns empty result for empty sources array', () => {
    const result = computeOwnershipDistribution([])
    expect(result.groups).toEqual([])
    expect(result.unknownCount).toBe(0)
    expect(result.concentrationIndex).toBe(0)
    expect(result.dominantOwner).toBeNull()
  })

  it('counts all sources as unknown when no owner is set', () => {
    const sources = [makeSource('a'), makeSource('b'), makeSource('c')]
    const result = computeOwnershipDistribution(sources)

    expect(result.groups).toEqual([])
    expect(result.unknownCount).toBe(3)
    expect(result.concentrationIndex).toBe(0)
    expect(result.dominantOwner).toBeNull()
  })

  it('identifies dominant owner when one owner covers >= 50% of sources', () => {
    const warner = makeOwner({ id: 'warner', name: 'Warner Bros. Discovery' })
    const nyt = makeOwner({ id: 'nyt', name: 'The New York Times Company' })

    const sources = [
      makeSource('1', warner),
      makeSource('2', warner),
      makeSource('3', warner),
      makeSource('4', warner),
      makeSource('5', warner),
      makeSource('6', warner),
      makeSource('7', nyt),
      makeSource('8', nyt),
      makeSource('9'),
      makeSource('10'),
    ]

    const result = computeOwnershipDistribution(sources)

    expect(result.groups).toHaveLength(2)
    expect(result.groups[0].ownerId).toBe('warner')
    expect(result.groups[0].sourceCount).toBe(6)
    expect(result.groups[0].percentage).toBe(60)
    expect(result.unknownCount).toBe(2)
    expect(result.dominantOwner?.ownerId).toBe('warner')
  })

  it('returns null dominantOwner when share is below 50%', () => {
    const ownerA = makeOwner({ id: 'a', name: 'A Corp' })
    const ownerB = makeOwner({ id: 'b', name: 'B Corp' })
    const ownerC = makeOwner({ id: 'c', name: 'C Corp' })

    const sources = [
      makeSource('1', ownerA),
      makeSource('2', ownerA),
      makeSource('3', ownerB),
      makeSource('4', ownerB),
      makeSource('5', ownerC),
      makeSource('6', ownerC),
    ]

    const result = computeOwnershipDistribution(sources)

    expect(result.groups).toHaveLength(3)
    expect(result.dominantOwner).toBeNull()
  })

  it('sorts groups by source count descending', () => {
    const big = makeOwner({ id: 'big', name: 'Big' })
    const small = makeOwner({ id: 'small', name: 'Small' })
    const mid = makeOwner({ id: 'mid', name: 'Mid' })

    const sources = [
      makeSource('1', small),
      makeSource('2', big),
      makeSource('3', mid),
      makeSource('4', big),
      makeSource('5', big),
      makeSource('6', mid),
    ]

    const result = computeOwnershipDistribution(sources)

    expect(result.groups.map((g) => g.ownerId)).toEqual(['big', 'mid', 'small'])
  })

  it('computes concentration index (HHI/10000) for evenly split ownership', () => {
    // 2 owners, each 50% → HHI = 50² + 50² = 5000 → index = 0.5
    const a = makeOwner({ id: 'a', name: 'A' })
    const b = makeOwner({ id: 'b', name: 'B' })
    const sources = [makeSource('1', a), makeSource('2', a), makeSource('3', b), makeSource('4', b)]

    const result = computeOwnershipDistribution(sources)
    expect(result.concentrationIndex).toBeCloseTo(0.5, 2)
  })

  it('yields concentration index 1.0 for single-owner scenario', () => {
    const sole = makeOwner({ id: 'sole', name: 'Sole' })
    const sources = [makeSource('1', sole), makeSource('2', sole), makeSource('3', sole)]

    const result = computeOwnershipDistribution(sources)
    expect(result.concentrationIndex).toBeCloseTo(1, 2)
    expect(result.dominantOwner?.ownerId).toBe('sole')
  })

  it('exposes ownerType and isIndividual on group entries', () => {
    const person = makeOwner({
      id: 'musk',
      name: 'Elon Musk',
      ownerType: 'individual',
      isIndividual: true,
    })
    const sources = [makeSource('1', person), makeSource('2', person)]

    const result = computeOwnershipDistribution(sources)

    expect(result.groups[0].ownerType).toBe('individual')
    expect(result.groups[0].isIndividual).toBe(true)
  })

  it('does NOT flag a dominant owner at 99/200 (49.5% share, rounds to 50% for display only)', () => {
    const a = makeOwner({ id: 'a', name: 'Big' })
    const b = makeOwner({ id: 'b', name: 'Other' })
    const sources: NewsSource[] = [
      ...Array.from({ length: 99 }, (_, i) => makeSource(`a-${i}`, a)),
      ...Array.from({ length: 101 }, (_, i) => makeSource(`b-${i}`, b)),
    ]

    const result = computeOwnershipDistribution(sources)

    // Display-only rounded percentage may show 50, but dominance is count-based
    expect(result.groups[0].sourceCount).toBe(101)
    expect(result.dominantOwner?.ownerId).toBe('b')

    // Flip: 99/200 is NOT dominant
    const flipped = computeOwnershipDistribution([
      ...Array.from({ length: 99 }, (_, i) => makeSource(`a-${i}`, a)),
      ...Array.from({ length: 99 }, (_, i) => makeSource(`b-${i}`, b)),
      makeSource('u1'),
      makeSource('u2'),
    ])
    expect(flipped.dominantOwner).toBeNull()
  })

  it('flags dominance at the exact 50/50 boundary (100/200)', () => {
    const a = makeOwner({ id: 'a', name: 'Big' })
    const sources: NewsSource[] = [
      ...Array.from({ length: 100 }, (_, i) => makeSource(`a-${i}`, a)),
      ...Array.from({ length: 100 }, (_, i) => makeSource(`u-${i}`)),
    ]
    const result = computeOwnershipDistribution(sources)
    // 100 of 200 known-and-unknown → count*2 >= total → dominant
    expect(result.dominantOwner?.ownerId).toBe('a')
  })

  it('excludes unknown-owner sources from groups but tracks unknownCount', () => {
    const a = makeOwner({ id: 'a', name: 'A' })
    const sources = [makeSource('1', a), makeSource('2'), makeSource('3')]
    const result = computeOwnershipDistribution(sources)

    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].sourceCount).toBe(1)
    // percentage is share of total sources (1 / 3 ≈ 33%) so UI bar reserves
    // room for the unknown slice
    expect(result.groups[0].percentage).toBe(33)
    expect(result.unknownCount).toBe(2)
  })
})
