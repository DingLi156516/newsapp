import { normalizeAllSidesBias, lookupAllSides } from '@/lib/bias-ratings/providers/allsides'

describe('normalizeAllSidesBias', () => {
  it('maps left to left', () => {
    expect(normalizeAllSidesBias('left')).toBe('left')
  })

  it('maps lean-left to lean-left', () => {
    expect(normalizeAllSidesBias('lean-left')).toBe('lean-left')
  })

  it('maps center to center', () => {
    expect(normalizeAllSidesBias('center')).toBe('center')
  })

  it('maps lean-right to lean-right', () => {
    expect(normalizeAllSidesBias('lean-right')).toBe('lean-right')
  })

  it('maps right to right', () => {
    expect(normalizeAllSidesBias('right')).toBe('right')
  })

  it('returns null for unknown values', () => {
    expect(normalizeAllSidesBias('far-left')).toBeNull()
  })
})

describe('lookupAllSides', () => {
  it('finds CNN by domain', () => {
    const result = lookupAllSides('https://www.cnn.com')
    expect(result.matched).toBe(true)
    expect(result.rating?.provider).toBe('allsides')
    expect(result.rating?.bias).toBe('left')
    expect(result.rating?.factuality).toBeNull()
    expect(result.matchedOn).toBe('cnn.com')
  })

  it('finds Reuters by bare domain', () => {
    const result = lookupAllSides('reuters.com')
    expect(result.matched).toBe(true)
    expect(result.rating?.bias).toBe('center')
  })

  it('finds WSJ with center rating', () => {
    const result = lookupAllSides('https://wsj.com')
    expect(result.matched).toBe(true)
    expect(result.rating?.bias).toBe('center')
  })

  it('returns not matched for unknown domain', () => {
    const result = lookupAllSides('https://unknownnewssite.com')
    expect(result.matched).toBe(false)
    expect(result.rating).toBeNull()
    expect(result.matchedOn).toBeNull()
  })

  it('never returns factuality data', () => {
    const result = lookupAllSides('https://www.foxnews.com')
    expect(result.matched).toBe(true)
    expect(result.rating?.factuality).toBeNull()
  })

  it('finds NPR with lean-left rating', () => {
    const result = lookupAllSides('npr.org')
    expect(result.matched).toBe(true)
    expect(result.rating?.bias).toBe('lean-left')
  })
})
