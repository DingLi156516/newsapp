import { describe, it, expect } from 'vitest'
import { preferencesUpdateSchema } from '@/lib/api/preferences-validation'

describe('preferencesUpdateSchema', () => {
  it('accepts valid partial update', () => {
    const result = preferencesUpdateSchema.safeParse({
      followed_topics: ['politics', 'technology'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.followed_topics).toEqual(['politics', 'technology'])
    }
  })

  it('accepts empty object (no changes)', () => {
    const result = preferencesUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects invalid perspective', () => {
    const result = preferencesUpdateSchema.safeParse({ default_perspective: 'extreme' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid factuality', () => {
    const result = preferencesUpdateSchema.safeParse({ factuality_minimum: 'unknown' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid topic in array', () => {
    const result = preferencesUpdateSchema.safeParse({
      followed_topics: ['politics', 'invalid-topic'],
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid perspectives', () => {
    for (const p of ['all', 'left', 'center', 'right']) {
      const result = preferencesUpdateSchema.safeParse({ default_perspective: p })
      expect(result.success).toBe(true)
    }
  })

  it('accepts all valid factualities', () => {
    for (const f of ['very-high', 'high', 'mixed', 'low', 'very-low']) {
      const result = preferencesUpdateSchema.safeParse({ factuality_minimum: f })
      expect(result.success).toBe(true)
    }
  })
})
