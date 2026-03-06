import {
  BIAS_LABELS,
  BIAS_CSS_CLASS,
  FACTUALITY_LABELS,
  OWNERSHIP_LABELS,
  TOPIC_LABELS,
} from '@/lib/types'
import type { BiasCategory, FactualityLevel, OwnershipType, Topic } from '@/lib/types'

const ALL_BIAS_CATEGORIES: BiasCategory[] = [
  'far-left',
  'left',
  'lean-left',
  'center',
  'lean-right',
  'right',
  'far-right',
]

const ALL_FACTUALITY_LEVELS: FactualityLevel[] = [
  'very-high',
  'high',
  'mixed',
  'low',
  'very-low',
]

const ALL_OWNERSHIP_TYPES: OwnershipType[] = [
  'independent',
  'corporate',
  'private-equity',
  'state-funded',
  'telecom',
  'government',
  'non-profit',
  'other',
]

const ALL_TOPICS: Topic[] = [
  'politics',
  'world',
  'technology',
  'business',
  'science',
  'health',
  'culture',
  'sports',
  'environment',
]

describe('BIAS_LABELS', () => {
  it('has an entry for all 7 BiasCategory values', () => {
    expect(Object.keys(BIAS_LABELS)).toHaveLength(7)
    ALL_BIAS_CATEGORIES.forEach((bias) => {
      expect(BIAS_LABELS[bias]).toBeDefined()
      expect(typeof BIAS_LABELS[bias]).toBe('string')
    })
  })

  it('returns non-empty strings for every bias', () => {
    ALL_BIAS_CATEGORIES.forEach((bias) => {
      expect(BIAS_LABELS[bias].length).toBeGreaterThan(0)
    })
  })
})

describe('BIAS_CSS_CLASS', () => {
  it('maps every BiasCategory to a string', () => {
    ALL_BIAS_CATEGORIES.forEach((bias) => {
      const cls = BIAS_CSS_CLASS[bias]
      expect(typeof cls).toBe('string')
      expect(cls.length).toBeGreaterThan(0)
    })
  })

  it('has exactly 7 entries', () => {
    expect(Object.keys(BIAS_CSS_CLASS)).toHaveLength(7)
  })

  it('all classes start with "spectrum-"', () => {
    ALL_BIAS_CATEGORIES.forEach((bias) => {
      expect(BIAS_CSS_CLASS[bias]).toMatch(/^spectrum-/)
    })
  })
})

describe('FACTUALITY_LABELS', () => {
  it('covers all 5 FactualityLevel values', () => {
    expect(Object.keys(FACTUALITY_LABELS)).toHaveLength(5)
    ALL_FACTUALITY_LEVELS.forEach((level) => {
      expect(FACTUALITY_LABELS[level]).toBeDefined()
      expect(typeof FACTUALITY_LABELS[level]).toBe('string')
    })
  })
})

describe('OWNERSHIP_LABELS', () => {
  it('covers all 8 OwnershipType values', () => {
    expect(Object.keys(OWNERSHIP_LABELS)).toHaveLength(8)
    ALL_OWNERSHIP_TYPES.forEach((type) => {
      expect(OWNERSHIP_LABELS[type]).toBeDefined()
      expect(typeof OWNERSHIP_LABELS[type]).toBe('string')
    })
  })
})

describe('TOPIC_LABELS', () => {
  it('covers all 9 Topic values', () => {
    expect(Object.keys(TOPIC_LABELS)).toHaveLength(9)
    ALL_TOPICS.forEach((topic) => {
      expect(TOPIC_LABELS[topic]).toBeDefined()
      expect(typeof TOPIC_LABELS[topic]).toBe('string')
    })
  })
})
