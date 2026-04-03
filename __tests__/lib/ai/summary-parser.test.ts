import { parseExpandedSummary } from '@/lib/ai/summary-generator'

describe('parseExpandedSummary', () => {
  it('parses a complete expanded summary', () => {
    const json = JSON.stringify({
      commonGround: '• Fact one\n• Fact two',
      leftFraming: '• Left view',
      rightFraming: '• Right view',
      leftSentiment: 'critical',
      rightSentiment: 'hopeful',
      keyQuotes: [
        { text: 'This is important', sourceName: 'CNN', sourceBias: 'lean-left' },
      ],
      keyClaims: [
        { claim: 'Taxes will rise', side: 'left', disputed: true, counterClaim: 'Deductions offset' },
      ],
    })

    const result = parseExpandedSummary(json)

    expect(result.aiSummary.commonGround).toBe('• Fact one\n• Fact two')
    expect(result.aiSummary.leftFraming).toBe('• Left view')
    expect(result.aiSummary.rightFraming).toBe('• Right view')
    expect(result.sentiment).toEqual({ left: 'critical', right: 'hopeful' })
    expect(result.keyQuotes).toEqual([
      { text: 'This is important', sourceName: 'CNN', sourceBias: 'lean-left' },
    ])
    expect(result.keyClaims).toEqual([
      { claim: 'Taxes will rise', side: 'left', disputed: true, counterClaim: 'Deductions offset' },
    ])
  })

  it('gracefully handles missing sentiment', () => {
    const json = JSON.stringify({
      commonGround: '• Facts',
      leftFraming: '• Left',
      rightFraming: '• Right',
    })

    const result = parseExpandedSummary(json)
    expect(result.aiSummary.commonGround).toBe('• Facts')
    expect(result.sentiment).toBeNull()
    expect(result.keyQuotes).toBeNull()
    expect(result.keyClaims).toBeNull()
  })

  it('rejects invalid sentiment values', () => {
    const json = JSON.stringify({
      commonGround: '• Facts',
      leftFraming: '• Left',
      rightFraming: '• Right',
      leftSentiment: 'invalid_value',
      rightSentiment: 'hopeful',
    })

    const result = parseExpandedSummary(json)
    expect(result.sentiment).toBeNull()
  })

  it('filters out malformed quotes', () => {
    const json = JSON.stringify({
      commonGround: '• Facts',
      leftFraming: '• Left',
      rightFraming: '• Right',
      keyQuotes: [
        { text: 'Valid quote', sourceName: 'CNN', sourceBias: 'lean-left' },
        { text: 123, sourceName: 'Fox' }, // invalid
        'not an object',
      ],
    })

    const result = parseExpandedSummary(json)
    expect(result.keyQuotes).toEqual([
      { text: 'Valid quote', sourceName: 'CNN', sourceBias: 'lean-left' },
    ])
  })

  it('filters out malformed claims', () => {
    const json = JSON.stringify({
      commonGround: '• Facts',
      leftFraming: '• Left',
      rightFraming: '• Right',
      keyClaims: [
        { claim: 'Valid claim', side: 'both', disputed: false },
        { claim: 'Invalid side', side: 'center', disputed: true }, // invalid side
        { claim: 'Missing disputed' }, // no disputed field
      ],
    })

    const result = parseExpandedSummary(json)
    expect(result.keyClaims).toEqual([
      { claim: 'Valid claim', side: 'both', disputed: false },
    ])
  })

  it('returns null for empty quotes/claims arrays', () => {
    const json = JSON.stringify({
      commonGround: '• Facts',
      leftFraming: '• Left',
      rightFraming: '• Right',
      keyQuotes: [],
      keyClaims: [],
    })

    const result = parseExpandedSummary(json)
    expect(result.keyQuotes).toBeNull()
    expect(result.keyClaims).toBeNull()
  })

  it('omits counterClaim when not present', () => {
    const json = JSON.stringify({
      commonGround: '• Facts',
      leftFraming: '• Left',
      rightFraming: '• Right',
      keyClaims: [
        { claim: 'A claim', side: 'left', disputed: false },
      ],
    })

    const result = parseExpandedSummary(json)
    expect(result.keyClaims![0]).not.toHaveProperty('counterClaim')
  })

  it('defaults missing summary fields to pending', () => {
    const json = JSON.stringify({})

    const result = parseExpandedSummary(json)
    expect(result.aiSummary.commonGround).toBe('Analysis pending.')
    expect(result.aiSummary.leftFraming).toBe('Analysis pending.')
    expect(result.aiSummary.rightFraming).toBe('Analysis pending.')
  })
})
