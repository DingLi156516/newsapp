import { normalizeMbfcBias, normalizeMbfcFactuality, lookupMbfc } from '@/lib/bias-ratings/providers/mbfc'

describe('normalizeMbfcBias', () => {
  it('maps extreme-left to far-left', () => {
    expect(normalizeMbfcBias('extreme-left')).toBe('far-left')
  })

  it('maps left to left', () => {
    expect(normalizeMbfcBias('left')).toBe('left')
  })

  it('maps left-center to lean-left', () => {
    expect(normalizeMbfcBias('left-center')).toBe('lean-left')
  })

  it('maps center to center', () => {
    expect(normalizeMbfcBias('center')).toBe('center')
  })

  it('maps pro-science to center', () => {
    expect(normalizeMbfcBias('pro-science')).toBe('center')
  })

  it('maps right-center to lean-right', () => {
    expect(normalizeMbfcBias('right-center')).toBe('lean-right')
  })

  it('maps right to right', () => {
    expect(normalizeMbfcBias('right')).toBe('right')
  })

  it('maps extreme-right to far-right', () => {
    expect(normalizeMbfcBias('extreme-right')).toBe('far-right')
  })

  it('returns null for questionable', () => {
    expect(normalizeMbfcBias('questionable')).toBeNull()
  })

  it('returns null for satire', () => {
    expect(normalizeMbfcBias('satire')).toBeNull()
  })

  it('returns null for conspiracy-pseudoscience', () => {
    expect(normalizeMbfcBias('conspiracy-pseudoscience')).toBeNull()
  })

  it('returns null for unknown values', () => {
    expect(normalizeMbfcBias('unknown')).toBeNull()
  })
})

describe('normalizeMbfcFactuality', () => {
  it('maps very-high to very-high', () => {
    expect(normalizeMbfcFactuality('very-high')).toBe('very-high')
  })

  it('maps high to high', () => {
    expect(normalizeMbfcFactuality('high')).toBe('high')
  })

  it('maps mostly-factual to high', () => {
    expect(normalizeMbfcFactuality('mostly-factual')).toBe('high')
  })

  it('maps mixed to mixed', () => {
    expect(normalizeMbfcFactuality('mixed')).toBe('mixed')
  })

  it('maps low to low', () => {
    expect(normalizeMbfcFactuality('low')).toBe('low')
  })

  it('maps very-low to very-low', () => {
    expect(normalizeMbfcFactuality('very-low')).toBe('very-low')
  })

  it('returns null for unknown values', () => {
    expect(normalizeMbfcFactuality('unknown')).toBeNull()
  })
})

describe('lookupMbfc', () => {
  it('finds CNN by domain', () => {
    const result = lookupMbfc('https://www.cnn.com')
    expect(result.matched).toBe(true)
    expect(result.rating?.provider).toBe('mbfc')
    expect(result.rating?.bias).toBe('left')
    expect(result.rating?.factuality).toBe('mixed')
    expect(result.matchedOn).toBe('cnn.com')
  })

  it('finds Reuters by bare domain', () => {
    const result = lookupMbfc('reuters.com')
    expect(result.matched).toBe(true)
    expect(result.rating?.bias).toBe('center')
    expect(result.rating?.factuality).toBe('very-high')
  })

  it('finds Fox News by URL with path', () => {
    const result = lookupMbfc('https://www.foxnews.com/politics')
    expect(result.matched).toBe(true)
    expect(result.rating?.bias).toBe('right')
  })

  it('returns not matched for unknown domain', () => {
    const result = lookupMbfc('https://unknownnewssite.com')
    expect(result.matched).toBe(false)
    expect(result.rating).toBeNull()
    expect(result.matchedOn).toBeNull()
  })

  it('returns not matched for questionable sources', () => {
    const result = lookupMbfc('https://thegatewaypundit.com')
    expect(result.matched).toBe(false)
    expect(result.rating).toBeNull()
  })

  it('maps NPR with very-high factuality', () => {
    const result = lookupMbfc('npr.org')
    expect(result.matched).toBe(true)
    expect(result.rating?.factuality).toBe('very-high')
    expect(result.rating?.bias).toBe('lean-left')
  })
})
