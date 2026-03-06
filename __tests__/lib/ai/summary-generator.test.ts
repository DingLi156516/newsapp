vi.mock('@/lib/ai/gemini-client', () => ({
  generateText: vi.fn(),
}))

describe('generateAISummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns default summary for empty articles', async () => {
    const { generateAISummary } = await import('@/lib/ai/summary-generator')
    const result = await generateAISummary([])

    expect(result.commonGround).toBe('Insufficient coverage for analysis.')
    expect(result.leftFraming).toBe('No left-leaning perspectives available.')
    expect(result.rightFraming).toBe('No right-leaning perspectives available.')
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

    expect(result.commonGround).toBe('• Both sides agree on X')
    expect(result.leftFraming).toBe('• Left sees Y')
    expect(result.rightFraming).toBe('• Right sees Z')
    expect(generateText).toHaveBeenCalledWith(expect.any(String), { jsonMode: true })
  })

  it('returns fallback on invalid JSON response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: 'not json at all' })

    const { generateAISummary } = await import('@/lib/ai/summary-generator')
    const result = await generateAISummary([
      { title: 'Test', description: 'Desc', bias: 'right' },
    ])

    expect(result.commonGround).toBe('AI summary generation failed. Manual review needed.')
  })
})
