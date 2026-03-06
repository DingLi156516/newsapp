describe('gemini-client', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' }
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllGlobals()
  })

  it('generateEmbedding throws when API key is missing', async () => {
    delete process.env.GEMINI_API_KEY
    const { generateEmbedding } = await import('@/lib/ai/gemini-client')
    await expect(generateEmbedding('test')).rejects.toThrow('Missing GEMINI_API_KEY')
  })

  it('generateEmbedding returns embedding values', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ embedding: { values: [0.1, 0.2, 0.3] } }),
    } as Response)

    const { generateEmbedding } = await import('@/lib/ai/gemini-client')
    const result = await generateEmbedding('test text')

    expect(result.embedding).toEqual([0.1, 0.2, 0.3])
  })

  it('generateEmbedding throws on API error', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    } as Response)

    const { generateEmbedding } = await import('@/lib/ai/gemini-client')
    await expect(generateEmbedding('test')).rejects.toThrow('Gemini embedding failed (429)')
  })

  it('generateText returns text content', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Generated response' }] } }],
        }),
    } as Response)

    const { generateText } = await import('@/lib/ai/gemini-client')
    const result = await generateText('test prompt')

    expect(result.text).toBe('Generated response')
  })

  it('generateText returns empty string when no candidates', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ candidates: [] }),
    } as Response)

    const { generateText } = await import('@/lib/ai/gemini-client')
    const result = await generateText('test prompt')

    expect(result.text).toBe('')
  })

  it('generateText with jsonMode includes responseMimeType in request', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: '{"key":"value"}' }] } }],
        }),
    } as Response)

    const { generateText } = await import('@/lib/ai/gemini-client')
    await generateText('test prompt', { jsonMode: true })

    const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(callBody.generationConfig.responseMimeType).toBe('application/json')
  })

  it('generateText without jsonMode omits responseMimeType', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'plain text' }] } }],
        }),
    } as Response)

    const { generateText } = await import('@/lib/ai/gemini-client')
    await generateText('test prompt')

    const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(callBody.generationConfig.responseMimeType).toBeUndefined()
  })

  it('generateEmbeddingBatch returns multiple embeddings', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          embeddings: [
            { values: [0.1, 0.2] },
            { values: [0.3, 0.4] },
          ],
        }),
    } as Response)

    const { generateEmbeddingBatch } = await import('@/lib/ai/gemini-client')
    const result = await generateEmbeddingBatch(['text1', 'text2'])

    expect(result).toHaveLength(2)
    expect(result[0].embedding).toEqual([0.1, 0.2])
    expect(result[1].embedding).toEqual([0.3, 0.4])
  })
})
