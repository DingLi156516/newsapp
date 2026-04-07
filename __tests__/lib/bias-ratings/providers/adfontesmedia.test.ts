import { lookupAdFontes } from '@/lib/bias-ratings/providers/adfontesmedia'

describe('lookupAdFontes', () => {
  it('always returns not matched', () => {
    const result = lookupAdFontes('https://www.cnn.com')
    expect(result.matched).toBe(false)
    expect(result.rating).toBeNull()
    expect(result.matchedOn).toBeNull()
  })

  it('returns not matched for any URL', () => {
    const result = lookupAdFontes('https://www.foxnews.com')
    expect(result.matched).toBe(false)
  })

  it('returns not matched for bare domain', () => {
    const result = lookupAdFontes('reuters.com')
    expect(result.matched).toBe(false)
  })
})
