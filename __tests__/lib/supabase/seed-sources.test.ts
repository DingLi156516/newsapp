import { seedSources, SEED_SOURCE_COUNT } from '@/lib/supabase/seed-sources'
import type { BiasCategory, FactualityLevel, OwnershipType, Region } from '@/lib/types'

const VALID_BIASES: BiasCategory[] = [
  'far-left', 'left', 'lean-left', 'center', 'lean-right', 'right', 'far-right',
]
const VALID_FACTUALITY: FactualityLevel[] = [
  'very-high', 'high', 'mixed', 'low', 'very-low',
]
const VALID_OWNERSHIP: OwnershipType[] = [
  'independent', 'corporate', 'private-equity', 'state-funded',
  'telecom', 'government', 'non-profit', 'other',
]
const VALID_REGIONS: Region[] = ['us', 'international', 'uk', 'canada', 'europe']

describe('seedSources', () => {
  it('contains at least 50 sources', () => {
    expect(seedSources.length).toBeGreaterThanOrEqual(50)
  })

  it('SEED_SOURCE_COUNT matches array length', () => {
    expect(SEED_SOURCE_COUNT).toBe(seedSources.length)
  })

  it('every source has a unique slug', () => {
    const slugs = seedSources.map((s) => s.slug)
    const uniqueSlugs = new Set(slugs)
    expect(uniqueSlugs.size).toBe(slugs.length)
  })

  it('every source has a non-empty name', () => {
    seedSources.forEach((source) => {
      expect(source.name.length).toBeGreaterThan(0)
    })
  })

  it('every source has a valid bias category', () => {
    seedSources.forEach((source) => {
      expect(VALID_BIASES).toContain(source.bias)
    })
  })

  it('every source has a valid factuality level', () => {
    seedSources.forEach((source) => {
      expect(VALID_FACTUALITY).toContain(source.factuality)
    })
  })

  it('every source has a valid ownership type', () => {
    seedSources.forEach((source) => {
      expect(VALID_OWNERSHIP).toContain(source.ownership)
    })
  })

  it('every source has a valid region', () => {
    seedSources.forEach((source) => {
      const region = source.region ?? 'us'
      expect(VALID_REGIONS).toContain(region)
    })
  })

  it('every source has a URL', () => {
    seedSources.forEach((source) => {
      expect(source.url).toBeDefined()
      expect(typeof source.url).toBe('string')
      expect(source.url!.length).toBeGreaterThan(0)
    })
  })

  it('every source has an RSS URL', () => {
    seedSources.forEach((source) => {
      expect(source.rss_url).toBeDefined()
      expect(typeof source.rss_url).toBe('string')
      expect(source.rss_url!.length).toBeGreaterThan(0)
    })
  })

  it('has sources across all 7 bias categories', () => {
    const biases = new Set(seedSources.map((s) => s.bias))
    VALID_BIASES.forEach((bias) => {
      expect(biases.has(bias)).toBe(true)
    })
  })

  it('has sources across multiple regions', () => {
    const regions = new Set(seedSources.map((s) => s.region ?? 'us'))
    expect(regions.size).toBeGreaterThanOrEqual(3)
  })

  it('slug format is lowercase kebab-case', () => {
    seedSources.forEach((source) => {
      expect(source.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    })
  })
})
