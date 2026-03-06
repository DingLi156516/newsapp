import { sampleArticles } from '@/lib/sample-data'

describe('sampleArticles', () => {
  it('has at least 6 items', () => {
    expect(sampleArticles.length).toBeGreaterThanOrEqual(6)
  })

  it('every article has a non-empty id, headline, and timestamp', () => {
    sampleArticles.forEach((article) => {
      expect(article.id).toBeTruthy()
      expect(article.headline).toBeTruthy()
      expect(article.timestamp).toBeTruthy()
    })
  })

  it('every article spectrumSegments percentages sum to ≤ 100', () => {
    sampleArticles.forEach((article) => {
      const total = article.spectrumSegments.reduce(
        (sum, seg) => sum + seg.percentage,
        0,
      )
      expect(total).toBeLessThanOrEqual(100)
    })
  })

  it('exactly 1 article has isBlindspot === true', () => {
    const blindspots = sampleArticles.filter((a) => a.isBlindspot)
    expect(blindspots).toHaveLength(1)
  })

  it('every source in article.sources has valid bias, factuality, ownership', () => {
    const validBias = new Set([
      'far-left', 'left', 'lean-left', 'center', 'lean-right', 'right', 'far-right',
    ])
    const validFactuality = new Set([
      'very-high', 'high', 'mixed', 'low', 'very-low',
    ])
    const validOwnership = new Set([
      'independent', 'corporate', 'private-equity', 'state-funded',
      'telecom', 'government', 'non-profit', 'other',
    ])

    sampleArticles.forEach((article) => {
      article.sources.forEach((source) => {
        expect(validBias.has(source.bias)).toBe(true)
        expect(validFactuality.has(source.factuality)).toBe(true)
        expect(validOwnership.has(source.ownership)).toBe(true)
      })
    })
  })

  it('every article has a non-empty sources array', () => {
    sampleArticles.forEach((article) => {
      expect(article.sources.length).toBeGreaterThan(0)
    })
  })
})
