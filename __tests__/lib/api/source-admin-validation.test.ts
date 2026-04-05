import { describe, it, expect } from 'vitest'
import {
  createSourceSchema,
  updateSourceSchema,
  csvRowSchema,
  discoverRssSchema,
  adminSourcesQuerySchema,
} from '@/lib/api/source-admin-validation'

describe('createSourceSchema', () => {
  const validInput = {
    name: 'Reuters',
    bias: 'center',
    factuality: 'very-high',
    ownership: 'independent',
  }

  it('accepts valid input with required fields only', () => {
    const result = createSourceSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Reuters')
      expect(result.data.bias).toBe('center')
      expect(result.data.factuality).toBe('very-high')
      expect(result.data.ownership).toBe('independent')
      expect(result.data.region).toBe('us')
    }
  })

  it('rejects missing name', () => {
    const result = createSourceSchema.safeParse({
      bias: 'center',
      factuality: 'high',
      ownership: 'corporate',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = createSourceSchema.safeParse({
      ...validInput,
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid bias value', () => {
    const result = createSourceSchema.safeParse({
      ...validInput,
      bias: 'extreme-left',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all optional fields', () => {
    const result = createSourceSchema.safeParse({
      ...validInput,
      url: 'https://reuters.com',
      rss_url: 'https://reuters.com/rss',
      region: 'uk',
      slug: 'reuters',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.url).toBe('https://reuters.com')
      expect(result.data.rss_url).toBe('https://reuters.com/rss')
      expect(result.data.region).toBe('uk')
      expect(result.data.slug).toBe('reuters')
    }
  })

  it('accepts nullable url and rss_url', () => {
    const result = createSourceSchema.safeParse({
      ...validInput,
      url: null,
      rss_url: null,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.url).toBeNull()
      expect(result.data.rss_url).toBeNull()
    }
  })

  it('accepts valid slug with lowercase and hyphens', () => {
    const result = createSourceSchema.safeParse({
      ...validInput,
      slug: 'the-new-york-times-123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects slug with uppercase letters', () => {
    const result = createSourceSchema.safeParse({
      ...validInput,
      slug: 'Reuters',
    })
    expect(result.success).toBe(false)
  })

  it('rejects slug with spaces', () => {
    const result = createSourceSchema.safeParse({
      ...validInput,
      slug: 'new york times',
    })
    expect(result.success).toBe(false)
  })

  it('rejects slug with underscores', () => {
    const result = createSourceSchema.safeParse({
      ...validInput,
      slug: 'new_york_times',
    })
    expect(result.success).toBe(false)
  })

  it('defaults region to us when not provided', () => {
    const result = createSourceSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.region).toBe('us')
    }
  })

  it('rejects invalid factuality', () => {
    const result = createSourceSchema.safeParse({
      ...validInput,
      factuality: 'unknown',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid ownership', () => {
    const result = createSourceSchema.safeParse({
      ...validInput,
      ownership: 'public',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid url format', () => {
    const result = createSourceSchema.safeParse({
      ...validInput,
      url: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('rejects private rss_url (169.254 link-local / AWS IMDS)', () => {
    const result = createSourceSchema.safeParse({
      ...validInput,
      rss_url: 'http://169.254.169.254',
    })
    expect(result.success).toBe(false)
  })

  it('rejects private url (10.x)', () => {
    const result = createSourceSchema.safeParse({
      ...validInput,
      url: 'http://10.0.0.1',
    })
    expect(result.success).toBe(false)
  })

  it('accepts public rss_url', () => {
    const result = createSourceSchema.safeParse({
      ...validInput,
      rss_url: 'https://reuters.com/rss',
    })
    expect(result.success).toBe(true)
  })

  it('accepts null rss_url (no SSRF regression)', () => {
    const result = createSourceSchema.safeParse({
      ...validInput,
      rss_url: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts undefined url (no SSRF regression)', () => {
    const result = createSourceSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.url).toBeUndefined()
    }
  })
})

describe('updateSourceSchema', () => {
  it('accepts partial update with single field', () => {
    const result = updateSourceSchema.safeParse({ name: 'Updated Name' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Updated Name')
    }
  })

  it('accepts empty object since all fields are optional', () => {
    const result = updateSourceSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts is_active boolean', () => {
    const result = updateSourceSchema.safeParse({ is_active: false })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.is_active).toBe(false)
    }
  })

  it('accepts multiple optional fields together', () => {
    const result = updateSourceSchema.safeParse({
      bias: 'left',
      factuality: 'high',
      region: 'europe',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.bias).toBe('left')
      expect(result.data.factuality).toBe('high')
      expect(result.data.region).toBe('europe')
    }
  })

  it('rejects invalid bias value', () => {
    const result = updateSourceSchema.safeParse({ bias: 'moderate' })
    expect(result.success).toBe(false)
  })

  it('rejects empty name string', () => {
    const result = updateSourceSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid url format', () => {
    const result = updateSourceSchema.safeParse({ url: 'bad-url' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid region', () => {
    const result = updateSourceSchema.safeParse({ region: 'australia' })
    expect(result.success).toBe(false)
  })

  it('accepts slug update', () => {
    const result = updateSourceSchema.safeParse({ slug: 'new-slug-123' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.slug).toBe('new-slug-123')
    }
  })

  it('rejects private rss_url (loopback)', () => {
    const result = updateSourceSchema.safeParse({ rss_url: 'http://127.0.0.1' })
    expect(result.success).toBe(false)
  })

  it('accepts public rss_url', () => {
    const result = updateSourceSchema.safeParse({ rss_url: 'https://reuters.com/rss' })
    expect(result.success).toBe(true)
  })
})

describe('csvRowSchema', () => {
  const validRow = {
    name: 'AP News',
    bias: 'center',
    factuality: 'very-high',
    ownership: 'non-profit',
  }

  it('accepts valid row with required fields', () => {
    const result = csvRowSchema.safeParse(validRow)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('AP News')
      expect(result.data.bias).toBe('center')
    }
  })

  it('rejects missing required name', () => {
    const result = csvRowSchema.safeParse({
      bias: 'center',
      factuality: 'high',
      ownership: 'corporate',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing required bias', () => {
    const result = csvRowSchema.safeParse({
      name: 'Test Source',
      factuality: 'high',
      ownership: 'corporate',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing required factuality', () => {
    const result = csvRowSchema.safeParse({
      name: 'Test Source',
      bias: 'center',
      ownership: 'corporate',
    })
    expect(result.success).toBe(false)
  })

  it('defaults optional fields when omitted', () => {
    const result = csvRowSchema.safeParse(validRow)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.url).toBeUndefined()
      expect(result.data.rss_url).toBeUndefined()
      expect(result.data.region).toBe('us')
      expect(result.data.slug).toBeUndefined()
    }
  })

  it('accepts empty string url and rss_url (treats as undefined)', () => {
    const result = csvRowSchema.safeParse({
      ...validRow,
      url: '',
      rss_url: '',
      slug: '',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.url).toBeUndefined()
      expect(result.data.rss_url).toBeUndefined()
      expect(result.data.slug).toBeUndefined()
    }
  })

  it('accepts all fields provided', () => {
    const result = csvRowSchema.safeParse({
      ...validRow,
      url: 'https://apnews.com',
      rss_url: 'https://apnews.com/rss',
      region: 'international',
      slug: 'ap-news',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.url).toBe('https://apnews.com')
      expect(result.data.region).toBe('international')
    }
  })

  it('rejects slug with uppercase letters', () => {
    const result = csvRowSchema.safeParse({ ...validRow, slug: 'AP-News' })
    expect(result.success).toBe(false)
  })

  it('rejects slug with spaces', () => {
    const result = csvRowSchema.safeParse({ ...validRow, slug: 'ap news' })
    expect(result.success).toBe(false)
  })

  it('accepts valid lowercase slug', () => {
    const result = csvRowSchema.safeParse({ ...validRow, slug: 'ap-news-123' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.slug).toBe('ap-news-123')
    }
  })

  it('rejects private rss_url (192.168.x)', () => {
    const result = csvRowSchema.safeParse({ ...validRow, rss_url: 'http://192.168.1.1' })
    expect(result.success).toBe(false)
  })

  it('accepts public rss_url', () => {
    const result = csvRowSchema.safeParse({ ...validRow, rss_url: 'https://reuters.com/rss' })
    expect(result.success).toBe(true)
  })
})

describe('discoverRssSchema', () => {
  it('accepts valid URL', () => {
    const result = discoverRssSchema.safeParse({ url: 'https://example.com' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.url).toBe('https://example.com')
    }
  })

  it('rejects invalid URL', () => {
    const result = discoverRssSchema.safeParse({ url: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('rejects empty string', () => {
    const result = discoverRssSchema.safeParse({ url: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing url field', () => {
    const result = discoverRssSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('adminSourcesQuerySchema', () => {
  it('applies defaults for empty input', () => {
    const result = adminSourcesQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(50)
      expect(result.data.is_active).toBe('all')
    }
  })

  it('coerces page and limit from strings', () => {
    const result = adminSourcesQuerySchema.safeParse({ page: '3', limit: '25' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.limit).toBe(25)
    }
  })

  it('accepts valid bias filter', () => {
    const result = adminSourcesQuerySchema.safeParse({ bias: 'left' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.bias).toBe('left')
    }
  })

  it('rejects invalid bias value', () => {
    const result = adminSourcesQuerySchema.safeParse({ bias: 'moderate' })
    expect(result.success).toBe(false)
  })

  it('converts empty bias string to undefined', () => {
    const result = adminSourcesQuerySchema.safeParse({ bias: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.bias).toBeUndefined()
    }
  })

  it('converts empty region string to undefined', () => {
    const result = adminSourcesQuerySchema.safeParse({ region: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.region).toBeUndefined()
    }
  })

  it('accepts valid region filter', () => {
    const result = adminSourcesQuerySchema.safeParse({ region: 'uk' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.region).toBe('uk')
    }
  })

  it('accepts search string', () => {
    const result = adminSourcesQuerySchema.safeParse({ search: 'reuters' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.search).toBe('reuters')
    }
  })

  it('rejects search with commas (PostgREST injection)', () => {
    const result = adminSourcesQuerySchema.safeParse({ search: 'cnn,slug.eq.x' })
    expect(result.success).toBe(false)
  })

  it('rejects search with dots', () => {
    const result = adminSourcesQuerySchema.safeParse({ search: 'slug.eq.admin' })
    expect(result.success).toBe(false)
  })

  it('accepts is_active filter values', () => {
    for (const value of ['all', 'true', 'false'] as const) {
      const result = adminSourcesQuerySchema.safeParse({ is_active: value })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.is_active).toBe(value)
      }
    }
  })

  it('rejects page less than 1', () => {
    const result = adminSourcesQuerySchema.safeParse({ page: '0' })
    expect(result.success).toBe(false)
  })

  it('rejects limit greater than 200', () => {
    const result = adminSourcesQuerySchema.safeParse({ limit: '201' })
    expect(result.success).toBe(false)
  })

  it('converts empty is_active string to default all', () => {
    const result = adminSourcesQuerySchema.safeParse({ is_active: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.is_active).toBe('all')
    }
  })
})
