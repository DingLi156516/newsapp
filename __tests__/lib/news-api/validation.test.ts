import { newsApiConfigSchema } from '@/lib/news-api/validation'

describe('newsApiConfigSchema', () => {
  it('parses a valid config with provider newsapi', () => {
    const result = newsApiConfigSchema.parse({ provider: 'newsapi' })

    expect(result.provider).toBe('newsapi')
  })

  it('parses a valid config with provider gdelt', () => {
    const result = newsApiConfigSchema.parse({ provider: 'gdelt' })

    expect(result.provider).toBe('gdelt')
  })

  it('rejects an invalid provider value', () => {
    const result = newsApiConfigSchema.safeParse({ provider: 'reuters' })

    expect(result.success).toBe(false)
  })

  it('rejects missing provider', () => {
    const result = newsApiConfigSchema.safeParse({})

    expect(result.success).toBe(false)
  })

  it('applies defaults: language=en, maxResults=30', () => {
    const result = newsApiConfigSchema.parse({ provider: 'newsapi' })

    expect(result.language).toBe('en')
    expect(result.maxResults).toBe(30)
  })

  it('allows all optional fields to be omitted', () => {
    const result = newsApiConfigSchema.parse({ provider: 'gdelt' })

    expect(result.query).toBeUndefined()
    expect(result.category).toBeUndefined()
    expect(result.country).toBeUndefined()
  })

  it('parses a fully-specified config', () => {
    const full = {
      provider: 'newsapi' as const,
      query: 'climate change',
      language: 'fr',
      category: 'science',
      country: 'us',
      maxResults: 50,
    }

    const result = newsApiConfigSchema.parse(full)

    expect(result).toEqual(full)
  })

  describe('maxResults bounds', () => {
    it('rejects maxResults below 1', () => {
      const result = newsApiConfigSchema.safeParse({
        provider: 'newsapi',
        maxResults: 0,
      })

      expect(result.success).toBe(false)
    })

    it('rejects maxResults above 100', () => {
      const result = newsApiConfigSchema.safeParse({
        provider: 'newsapi',
        maxResults: 101,
      })

      expect(result.success).toBe(false)
    })

    it('accepts maxResults at lower bound (1)', () => {
      const result = newsApiConfigSchema.parse({
        provider: 'gdelt',
        maxResults: 1,
      })

      expect(result.maxResults).toBe(1)
    })

    it('accepts maxResults at upper bound (100)', () => {
      const result = newsApiConfigSchema.parse({
        provider: 'gdelt',
        maxResults: 100,
      })

      expect(result.maxResults).toBe(100)
    })

    it('rejects non-integer maxResults', () => {
      const result = newsApiConfigSchema.safeParse({
        provider: 'newsapi',
        maxResults: 10.5,
      })

      expect(result.success).toBe(false)
    })
  })

  it('rejects query exceeding max length (500)', () => {
    const result = newsApiConfigSchema.safeParse({
      provider: 'newsapi',
      query: 'x'.repeat(501),
    })

    expect(result.success).toBe(false)
  })

  it('accepts query at max length (500)', () => {
    const result = newsApiConfigSchema.parse({
      provider: 'newsapi',
      query: 'x'.repeat(500),
    })

    expect(result.query).toHaveLength(500)
  })
})
