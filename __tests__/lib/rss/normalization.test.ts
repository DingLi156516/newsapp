import { describe, it, expect } from 'vitest'
import { normalizeArticleUrl, createTitleFingerprint } from '@/lib/rss/normalization'

describe('normalizeArticleUrl', () => {
  it('removes hashes and marketing query params', () => {
    expect(
      normalizeArticleUrl('https://example.com/story?utm_source=rss&utm_medium=feed&id=42#section-1')
    ).toBe('https://example.com/story?id=42')
  })

  it('keeps meaningful query params in stable order', () => {
    expect(
      normalizeArticleUrl('https://example.com/story?b=2&a=1')
    ).toBe('https://example.com/story?a=1&b=2')
  })

  it('normalizes host casing and trims trailing slash', () => {
    expect(
      normalizeArticleUrl('HTTPS://WWW.EXAMPLE.COM/story/')
    ).toBe('https://www.example.com/story')
  })
})

describe('createTitleFingerprint', () => {
  it('normalizes punctuation, case, and whitespace', () => {
    expect(
      createTitleFingerprint('Breaking: Major Merger Talks Resume!!!')
    ).toBe('breaking major merger talks resume')
  })

  it('returns empty string for blank titles', () => {
    expect(createTitleFingerprint('   ')).toBe('')
  })

  it('transliterates Chinese titles to non-empty ASCII', () => {
    const result = createTitleFingerprint('中国经济增长')
    expect(result).not.toBe('')
    expect(result).toMatch(/^[a-z0-9 ]+$/)
  })

  it('transliterates accented Latin characters', () => {
    expect(
      createTitleFingerprint('François Hollande élu président')
    ).toBe('francois hollande elu president')
  })

  it('handles mixed scripts', () => {
    const result = createTitleFingerprint('Breaking: 北京市新规')
    expect(result).toContain('breaking')
    expect(result.length).toBeGreaterThan('breaking'.length)
  })
})
