vi.mock('@/lib/ai/gemini-client', () => ({
  generateText: vi.fn(),
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

    expect(result).toBe('technology')
  })

  it('falls back to politics for invalid topic', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: 'invalid-topic' })

    const { classifyTopic } = await import('@/lib/ai/topic-classifier')
    const result = await classifyTopic(['Some article'])

    expect(result).toBe('politics')
  })

  it('returns politics for empty input', async () => {
    const { classifyTopic } = await import('@/lib/ai/topic-classifier')
    const result = await classifyTopic([])

    expect(result).toBe('politics')
  })

  it('trims whitespace from response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: '  health  \n' })

    const { classifyTopic } = await import('@/lib/ai/topic-classifier')
    const result = await classifyTopic(['mRNA vaccine trial results'])

    expect(result).toBe('health')
  })
})
