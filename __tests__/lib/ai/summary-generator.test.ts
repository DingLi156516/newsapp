vi.mock('@/lib/ai/gemini-client', () => ({
  generateText: vi.fn(),
  SUMMARY_GENERATION_MODEL: 'models/gemini-2.5-flash',
}))

describe('generateAISummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns default summary for empty articles', async () => {
    const { generateAISummary } = await import('@/lib/ai/summary-generator')
    const result = await generateAISummary([])

    expect(result.aiSummary.commonGround).toBe('Insufficient coverage for analysis.')
    expect(result.aiSummary.leftFraming).toBe('No left-leaning perspectives available.')
    expect(result.aiSummary.rightFraming).toBe('No right-leaning perspectives available.')
    expect(result.sentiment).toBeNull()
    expect(result.keyQuotes).toBeNull()
    expect(result.keyClaims).toBeNull()
  })

  it('parses valid JSON response and passes jsonMode', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        commonGround: '• Both sides agree on X',
        leftFraming: '• Left sees Y',
        rightFraming: '• Right sees Z',
      }),
    })

    const { generateAISummary } = await import('@/lib/ai/summary-generator')
    const result = await generateAISummary([
      { title: 'Test', description: 'Desc', bias: 'center' },
    ])

    expect(result.aiSummary.commonGround).toBe('• Both sides agree on X')
    expect(result.aiSummary.leftFraming).toBe('• Left sees Y')
    expect(result.aiSummary.rightFraming).toBe('• Right sees Z')
    expect(generateText).toHaveBeenCalledWith(expect.any(String), {
      jsonMode: true,
      model: 'models/gemini-2.5-flash',
    })
  })

  it('returns fallback on invalid JSON response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: 'not json at all' })

    const { generateAISummary } = await import('@/lib/ai/summary-generator')
    const result = await generateAISummary([
      { title: 'Test', description: 'Desc', bias: 'right' },
    ])

    expect(result.aiSummary.commonGround).toBe('AI summary generation failed. Manual review needed.')
  })

  it('uses the summary model when retrying with fewer articles', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText)
      .mockResolvedValueOnce({ text: '' })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          commonGround: '• Common ground',
          leftFraming: '• Left framing',
          rightFraming: '• Right framing',
        }),
      })

    const { generateAISummary } = await import('@/lib/ai/summary-generator')
    await generateAISummary([
      { title: 'One', description: 'Desc', bias: 'left' },
      { title: 'Two', description: 'Desc', bias: 'right' },
    ])

    expect(generateText).toHaveBeenNthCalledWith(1, expect.any(String), {
      jsonMode: true,
      model: 'models/gemini-2.5-flash',
    })
    expect(generateText).toHaveBeenNthCalledWith(2, expect.any(String), {
      jsonMode: true,
      model: 'models/gemini-2.5-flash',
    })
  })
})

describe('isFallbackSummary', () => {
  it('returns true for ExpandedSummaryResult with fallback content', async () => {
    const { isFallbackSummary } = await import('@/lib/ai/summary-generator')

    const result = isFallbackSummary({
      aiSummary: {
        commonGround: 'AI summary generation failed. Manual review needed.',
        leftFraming: 'Analysis unavailable.',
        rightFraming: 'Analysis unavailable.',
      },
      sentiment: null,
      keyQuotes: null,
      keyClaims: null,
    })
    expect(result).toBe(true)
  })

  it('returns false for ExpandedSummaryResult with real content', async () => {
    const { isFallbackSummary } = await import('@/lib/ai/summary-generator')

    const result = isFallbackSummary({
      aiSummary: {
        commonGround: '• Real analysis of the story',
        leftFraming: '• Left perspective here',
        rightFraming: '• Right perspective here',
      },
      sentiment: { left: 'critical', right: 'hopeful' },
      keyQuotes: null,
      keyClaims: null,
    })
    expect(result).toBe(false)
  })

  it('returns true for plain AISummary with fallback content', async () => {
    const { isFallbackSummary } = await import('@/lib/ai/summary-generator')

    const result = isFallbackSummary({
      commonGround: 'AI summary generation failed. Manual review needed.',
      leftFraming: 'Analysis unavailable.',
      rightFraming: 'Analysis unavailable.',
    })
    expect(result).toBe(true)
  })

  it('returns false for plain AISummary with real content', async () => {
    const { isFallbackSummary } = await import('@/lib/ai/summary-generator')

    const result = isFallbackSummary({
      commonGround: '• Both sides agree on facts',
      leftFraming: '• Left view',
      rightFraming: '• Right view',
    })
    expect(result).toBe(false)
  })
})
