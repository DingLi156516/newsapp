import { ownersQuerySchema } from '@/lib/api/owner-validation'

describe('ownersQuerySchema', () => {
  it('returns defaults when no params provided', () => {
    const result = ownersQuerySchema.parse({})
    expect(result).toEqual({
      page: 1,
      limit: 50,
    })
  })

  it('parses valid search string', () => {
    const result = ownersQuerySchema.parse({ search: 'Fox' })
    expect(result.search).toBe('Fox')
  })

  it('parses valid owner_type filter', () => {
    const result = ownersQuerySchema.parse({ owner_type: 'public_company' })
    expect(result.owner_type).toBe('public_company')
  })

  it('rejects invalid owner_type', () => {
    const result = ownersQuerySchema.safeParse({ owner_type: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('coerces page and limit to numbers', () => {
    const result = ownersQuerySchema.parse({ page: '3', limit: '25' })
    expect(result.page).toBe(3)
    expect(result.limit).toBe(25)
  })

  it('clamps limit to max 200', () => {
    const result = ownersQuerySchema.safeParse({ limit: '500' })
    expect(result.success).toBe(false)
  })

  it('rejects page < 1', () => {
    const result = ownersQuerySchema.safeParse({ page: '0' })
    expect(result.success).toBe(false)
  })

  it('accepts all valid owner_type values', () => {
    const types = [
      'public_company', 'private_company', 'cooperative',
      'public_broadcaster', 'trust', 'individual',
      'state_adjacent', 'nonprofit',
    ]
    for (const t of types) {
      const result = ownersQuerySchema.safeParse({ owner_type: t })
      expect(result.success).toBe(true)
    }
  })
})
