import { cosineSimilarity, computeCentroid } from '@/lib/ai/clustering'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3]
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0]
    const b = [0, 1]
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0)
  })

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0]
    const b = [-1, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0)
  })

  it('returns 0 for zero vectors', () => {
    const a = [0, 0, 0]
    const b = [1, 2, 3]
    expect(cosineSimilarity(a, b)).toBe(0)
  })

  it('computes correct similarity for general vectors', () => {
    const a = [1, 2, 3]
    const b = [4, 5, 6]
    const expected = 32 / (Math.sqrt(14) * Math.sqrt(77))
    expect(cosineSimilarity(a, b)).toBeCloseTo(expected)
  })
})

describe('computeCentroid', () => {
  it('returns empty array for empty input', () => {
    expect(computeCentroid([])).toEqual([])
  })

  it('returns the vector itself for single input', () => {
    expect(computeCentroid([[1, 2, 3]])).toEqual([1, 2, 3])
  })

  it('computes element-wise average', () => {
    const vectors = [
      [2, 4, 6],
      [4, 6, 8],
    ]
    expect(computeCentroid(vectors)).toEqual([3, 5, 7])
  })

  it('handles three vectors correctly', () => {
    const vectors = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]
    const result = computeCentroid(vectors)
    expect(result[0]).toBeCloseTo(1 / 3)
    expect(result[1]).toBeCloseTo(1 / 3)
    expect(result[2]).toBeCloseTo(1 / 3)
  })
})
