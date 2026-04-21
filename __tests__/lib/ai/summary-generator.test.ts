vi.mock('@/lib/ai/gemini-client', () => ({
  generateText: vi.fn(),
  SUMMARY_GENERATION_MODEL: 'models/gemini-2.5-flash',
  CHEAP_GENERATION_MODEL: 'models/gemini-2.5-flash-lite',
}))

describe('generateAISummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes article sourceName in the prompt when present', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        commonGround: '• cg',
        leftFraming: '• lf',
        rightFraming: '• rf',
      }),
    })

    const { generateAISummary } = await import('@/lib/ai/summary-generator')
    await generateAISummary([
      { title: 'A title', description: 'A desc', bias: 'left', sourceName: 'The New York Times' },
      { title: 'B title', description: 'B desc', bias: 'right', sourceName: 'Fox News' },
    ])

    const prompt = vi.mocked(generateText).mock.calls[0][0]
    // Without outlet in the prompt, the model cannot emit keyQuote.sourceName
    // accurately, and the verifier's outlet check will drop all quotes.
    expect(prompt).toContain('The New York Times')
    expect(prompt).toContain('Fox News')
  })

  it('frames regeneration hints as advisory rather than absolute', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        commonGround: '• cg',
        leftFraming: '• lf',
        rightFraming: '• rf',
      }),
    })

    const { generateAISummary } = await import('@/lib/ai/summary-generator')
    await generateAISummary(
      [{ title: 'x', description: null, bias: 'center' }],
      { regenerationHints: { dropQuotes: ['some quote'], dropClaims: [] } }
    )
    const prompt = vi.mocked(generateText).mock.calls[0][0]
    // The hint should allow the model to reuse the text with corrected
    // attribution — not blacklist grounded content permanently.
    expect(prompt.toLowerCase()).not.toMatch(/do not (include|use)/)
    expect(prompt).toContain('some quote')
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

describe('generateSingleSourceSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns summary with empty leftFraming and rightFraming', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        summary: '• Key facts from the article',
        keyQuotes: [],
        keyClaims: [{ claim: 'A claim', side: 'both', disputed: false }],
      }),
    })

    const { generateSingleSourceSummary } = await import('@/lib/ai/summary-generator')
    const result = await generateSingleSourceSummary({
      title: 'Test Article',
      description: 'Description here',
      bias: 'left',
    })

    expect(result.aiSummary.commonGround).toBe('• Key facts from the article')
    expect(result.aiSummary.leftFraming).toBe('')
    expect(result.aiSummary.rightFraming).toBe('')
    expect(result.sentiment).toBeNull()
  })

  it('uses CHEAP_GENERATION_MODEL', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        summary: '• Facts',
        keyQuotes: [],
        keyClaims: [],
      }),
    })

    const { generateSingleSourceSummary } = await import('@/lib/ai/summary-generator')
    await generateSingleSourceSummary({
      title: 'Test',
      description: null,
      bias: 'center',
    })

    expect(generateText).toHaveBeenCalledWith(expect.any(String), {
      jsonMode: true,
      model: 'models/gemini-2.5-flash-lite',
    })
  })

  it('returns fallback with sentinel marker when API returns empty response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: '' })

    const { generateSingleSourceSummary, isFallbackSummary } = await import('@/lib/ai/summary-generator')
    const result = await generateSingleSourceSummary({
      title: 'Fallback Test',
      description: 'Desc',
      bias: 'right',
    })

    expect(result.aiSummary.commonGround).toContain('Fallback Test')
    expect(result.aiSummary.leftFraming).toBe('[single-source-fallback]')
    expect(result.aiSummary.rightFraming).toBe('')
    expect(isFallbackSummary(result)).toBe(true)
  })

  it('returns fallback with sentinel marker when API throws', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockRejectedValue(new Error('API error'))

    const { generateSingleSourceSummary, isFallbackSummary } = await import('@/lib/ai/summary-generator')
    const result = await generateSingleSourceSummary({
      title: 'Error Test',
      description: null,
      bias: 'center',
    })

    expect(result.aiSummary.commonGround).toContain('Error Test')
    expect(isFallbackSummary(result)).toBe(true)
    expect(result.sentiment).toBeNull()
  })

  it('successful single-source summary is NOT detected as fallback', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        summary: '• Key facts',
        keyQuotes: [],
        keyClaims: [],
      }),
    })

    const { generateSingleSourceSummary, isFallbackSummary } = await import('@/lib/ai/summary-generator')
    const result = await generateSingleSourceSummary({
      title: 'Good Article',
      description: 'Desc',
      bias: 'center',
    })

    expect(result.aiSummary.leftFraming).toBe('')
    expect(isFallbackSummary(result)).toBe(false)
  })
})
