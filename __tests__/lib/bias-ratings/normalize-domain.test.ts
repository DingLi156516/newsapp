import { normalizeDomain } from '@/lib/bias-ratings/normalize-domain'

describe('normalizeDomain', () => {
  it('strips https protocol', () => {
    expect(normalizeDomain('https://cnn.com')).toBe('cnn.com')
  })

  it('strips http protocol', () => {
    expect(normalizeDomain('http://cnn.com')).toBe('cnn.com')
  })

  it('strips www prefix', () => {
    expect(normalizeDomain('https://www.cnn.com')).toBe('cnn.com')
  })

  it('strips trailing path', () => {
    expect(normalizeDomain('https://www.cnn.com/news/')).toBe('cnn.com')
  })

  it('strips query parameters', () => {
    expect(normalizeDomain('https://cnn.com?page=1')).toBe('cnn.com')
  })

  it('strips hash fragment', () => {
    expect(normalizeDomain('https://cnn.com#section')).toBe('cnn.com')
  })

  it('handles bare domain without protocol', () => {
    expect(normalizeDomain('cnn.com')).toBe('cnn.com')
  })

  it('handles domain with www but no protocol', () => {
    expect(normalizeDomain('www.cnn.com')).toBe('cnn.com')
  })

  it('lowercases the domain', () => {
    expect(normalizeDomain('https://CNN.COM')).toBe('cnn.com')
  })

  it('trims whitespace', () => {
    expect(normalizeDomain('  https://cnn.com  ')).toBe('cnn.com')
  })

  it('handles complex paths', () => {
    expect(normalizeDomain('https://www.bbc.com/news/world-us-canada-12345')).toBe('bbc.com')
  })

  it('preserves subdomains other than www', () => {
    expect(normalizeDomain('https://abcnews.go.com/politics')).toBe('abcnews.go.com')
  })

  it('strips trailing dots', () => {
    expect(normalizeDomain('cnn.com.')).toBe('cnn.com')
  })

  it('strips port 443', () => {
    expect(normalizeDomain('https://cnn.com:443')).toBe('cnn.com')
  })

  it('strips port 8080', () => {
    expect(normalizeDomain('http://localhost:8080/news')).toBe('localhost')
  })
})
