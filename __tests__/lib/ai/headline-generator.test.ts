vi.mock('@/lib/ai/gemini-client', () => ({
  generateText: vi.fn(),
  CHEAP_GENERATION_MODEL: 'models/gemini-2.5-flash-lite',
}))

describe('generateNeutralHeadline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates a headline from article titles', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: 'Congress Debates New AI Regulation Bill' })

    const { generateNeutralHeadline } = await import('@/lib/ai/headline-generator')
    const result = await generateNeutralHeadline(['AI bill passes House', 'Senate to vote on AI regulation'])

    expect(result).toEqual({
      headline: 'Congress Debates New AI Regulation Bill',
      usedCheapModel: true,
      usedFallback: false,
    })
    expect(generateText).toHaveBeenCalledOnce()
  })

  it('strips surrounding quotes from response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: '"AI Regulation Advances in Congress"' })

    const { generateNeutralHeadline } = await import('@/lib/ai/headline-generator')
    const result = await generateNeutralHeadline(['AI regulation moves forward'])

    expect(result).toEqual({
      headline: 'AI Regulation Advances in Congress',
      usedCheapModel: true,
      usedFallback: false,
    })
  })

  it('trims whitespace from response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: '  Some Headline  \n' })

    const { generateNeutralHeadline } = await import('@/lib/ai/headline-generator')
    const result = await generateNeutralHeadline(['test title'])

    expect(result).toEqual({
      headline: 'Some Headline',
      usedCheapModel: true,
      usedFallback: false,
    })
  })

  it('throws on empty article list', async () => {
    const { generateNeutralHeadline } = await import('@/lib/ai/headline-generator')
    await expect(generateNeutralHeadline([])).rejects.toThrow('Cannot generate headline from empty article list')
  })

  it('falls back to the first article title when generation fails', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockRejectedValue(new Error('model unavailable'))

    const { generateNeutralHeadline } = await import('@/lib/ai/headline-generator')
    const result = await generateNeutralHeadline([
      'AI regulation moves forward in Congress',
      'Senate debates new AI rules',
    ])

    expect(result).toEqual({
      headline: 'AI regulation moves forward in Congress',
      usedCheapModel: true,
      usedFallback: true,
    })
  })
})
