vi.mock('@/lib/ai/gemini-client', () => ({
  generateText: vi.fn(),
}))

describe('classifyRegion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns region from valid Gemini response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: 'uk' })

    const { classifyRegion } = await import('@/lib/ai/region-classifier')
    const result = await classifyRegion(['UK Parliament passes new climate bill'])

    expect(result).toBe('uk')
  })

  it('falls back to us for invalid region', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: 'australia' })

    const { classifyRegion } = await import('@/lib/ai/region-classifier')
    const result = await classifyRegion(['Some article'])

    expect(result).toBe('us')
  })

  it('returns us for empty input', async () => {
    const { classifyRegion } = await import('@/lib/ai/region-classifier')
    const result = await classifyRegion([])

    expect(result).toBe('us')
  })

  it('trims whitespace from response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: '  europe  \n' })

    const { classifyRegion } = await import('@/lib/ai/region-classifier')
    const result = await classifyRegion(['EU summit on migration policy'])

    expect(result).toBe('europe')
  })

  it('handles canada response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: 'canada' })

    const { classifyRegion } = await import('@/lib/ai/region-classifier')
    const result = await classifyRegion(['Canadian PM announces new policy'])

    expect(result).toBe('canada')
  })

  it('handles international response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: 'international' })

    const { classifyRegion } = await import('@/lib/ai/region-classifier')
    const result = await classifyRegion(['G20 leaders meet in global summit'])

    expect(result).toBe('international')
  })

  it('falls back to keyword heuristics when generation fails', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockRejectedValue(new Error('model unavailable'))

    const { classifyRegion } = await import('@/lib/ai/region-classifier')
    const result = await classifyRegion(['UK Parliament passes new climate bill'])

    expect(result).toBe('uk')
  })
})
