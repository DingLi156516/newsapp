import { crawlerConfigSchema } from '@/lib/crawler/validation'

describe('crawlerConfigSchema', () => {
  const validConfig = {
    articleListUrl: 'https://example.com/articles',
    articleLinkSelector: 'a.article-link',
  }

  it('parses a valid config with only required fields', () => {
    const result = crawlerConfigSchema.parse(validConfig)

    expect(result.articleListUrl).toBe('https://example.com/articles')
    expect(result.articleLinkSelector).toBe('a.article-link')
  })

  it('parses a valid config with all optional fields', () => {
    const full = {
      ...validConfig,
      contentSelector: 'div.content',
      titleSelector: 'h1.title',
      imageSelector: 'img.hero',
      jsRender: true,
      maxArticles: 50,
    }

    const result = crawlerConfigSchema.parse(full)

    expect(result.contentSelector).toBe('div.content')
    expect(result.titleSelector).toBe('h1.title')
    expect(result.imageSelector).toBe('img.hero')
    expect(result.jsRender).toBe(true)
    expect(result.maxArticles).toBe(50)
  })

  it('applies defaults: jsRender=false, maxArticles=30', () => {
    const result = crawlerConfigSchema.parse(validConfig)

    expect(result.jsRender).toBe(false)
    expect(result.maxArticles).toBe(30)
  })

  it('rejects missing articleListUrl', () => {
    const result = crawlerConfigSchema.safeParse({
      articleLinkSelector: 'a.link',
    })

    expect(result.success).toBe(false)
  })

  it('rejects missing articleLinkSelector', () => {
    const result = crawlerConfigSchema.safeParse({
      articleListUrl: 'https://example.com/articles',
    })

    expect(result.success).toBe(false)
  })

  it('rejects empty articleLinkSelector', () => {
    const result = crawlerConfigSchema.safeParse({
      ...validConfig,
      articleLinkSelector: '',
    })

    expect(result.success).toBe(false)
  })

  it('rejects invalid URL format for articleListUrl', () => {
    const result = crawlerConfigSchema.safeParse({
      ...validConfig,
      articleListUrl: 'not-a-url',
    })

    expect(result.success).toBe(false)
  })

  it('rejects non-URL string for articleListUrl', () => {
    const result = crawlerConfigSchema.safeParse({
      ...validConfig,
      articleListUrl: 'just some text with spaces',
    })

    expect(result.success).toBe(false)
  })

  describe('SSRF protection — rejects private/reserved addresses', () => {
    it.each([
      ['localhost', 'http://localhost/foo'],
      ['127.0.0.1', 'http://127.0.0.1/foo'],
      ['192.168.x.x', 'http://192.168.1.1/foo'],
      ['10.x.x.x', 'http://10.0.0.1/foo'],
      ['169.254.x.x', 'http://169.254.169.254/latest/meta-data'],
    ])('rejects %s URL', (_label, url) => {
      const result = crawlerConfigSchema.safeParse({
        ...validConfig,
        articleListUrl: url,
      })

      expect(result.success).toBe(false)
    })
  })

  describe('maxArticles bounds', () => {
    it('rejects maxArticles below 1', () => {
      const result = crawlerConfigSchema.safeParse({
        ...validConfig,
        maxArticles: 0,
      })

      expect(result.success).toBe(false)
    })

    it('rejects maxArticles above 100', () => {
      const result = crawlerConfigSchema.safeParse({
        ...validConfig,
        maxArticles: 101,
      })

      expect(result.success).toBe(false)
    })

    it('accepts maxArticles at lower bound (1)', () => {
      const result = crawlerConfigSchema.parse({
        ...validConfig,
        maxArticles: 1,
      })

      expect(result.maxArticles).toBe(1)
    })

    it('accepts maxArticles at upper bound (100)', () => {
      const result = crawlerConfigSchema.parse({
        ...validConfig,
        maxArticles: 100,
      })

      expect(result.maxArticles).toBe(100)
    })

    it('rejects non-integer maxArticles', () => {
      const result = crawlerConfigSchema.safeParse({
        ...validConfig,
        maxArticles: 5.5,
      })

      expect(result.success).toBe(false)
    })
  })
})
