vi.mock('@/lib/ai/gemini-client', () => ({
  generateText: vi.fn(),
  CHEAP_GENERATION_MODEL: 'models/gemini-2.5-flash-lite',
}))

describe('classifyTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns topic from valid Gemini response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: 'technology' })

    const { classifyTopic } = await import('@/lib/ai/topic-classifier')
    const result = await classifyTopic(['AI regulation advances in Congress'])

    expect(result).toEqual({
      topic: 'technology',
      usedCheapModel: true,
      usedFallback: false,
    })
  })

  it('falls back to politics for invalid topic', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: 'invalid-topic' })

    const { classifyTopic } = await import('@/lib/ai/topic-classifier')
    const result = await classifyTopic(['Some article'])

    expect(result).toEqual({
      topic: 'politics',
      usedCheapModel: true,
      usedFallback: true,
    })
  })

  it('returns politics for empty input', async () => {
    const { classifyTopic } = await import('@/lib/ai/topic-classifier')
    const result = await classifyTopic([])

    expect(result).toEqual({
      topic: 'politics',
      usedCheapModel: false,
      usedFallback: true,
    })
  })

  it('trims whitespace from response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: '  health  \n' })

    const { classifyTopic } = await import('@/lib/ai/topic-classifier')
    const result = await classifyTopic(['mRNA vaccine trial results'])

    expect(result).toEqual({
      topic: 'health',
      usedCheapModel: true,
      usedFallback: false,
    })
  })

  it('falls back to keyword heuristics when generation fails', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockRejectedValue(new Error('model unavailable'))

    const { classifyTopic } = await import('@/lib/ai/topic-classifier')
    const result = await classifyTopic(['AI regulation advances in Congress'])

    expect(result).toEqual({
      topic: 'technology',
      usedCheapModel: true,
      usedFallback: true,
    })
  })
})
