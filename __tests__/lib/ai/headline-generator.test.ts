vi.mock('@/lib/ai/gemini-client', () => ({
  generateText: vi.fn(),
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

    expect(result).toBe('Congress Debates New AI Regulation Bill')
    expect(generateText).toHaveBeenCalledOnce()
  })

  it('strips surrounding quotes from response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: '"AI Regulation Advances in Congress"' })

    const { generateNeutralHeadline } = await import('@/lib/ai/headline-generator')
    const result = await generateNeutralHeadline(['AI regulation moves forward'])

    expect(result).toBe('AI Regulation Advances in Congress')
  })

  it('trims whitespace from response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: '  Some Headline  \n' })

    const { generateNeutralHeadline } = await import('@/lib/ai/headline-generator')
    const result = await generateNeutralHeadline(['test title'])

    expect(result).toBe('Some Headline')
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

    expect(result).toBe('AI regulation moves forward in Congress')
  })
})
