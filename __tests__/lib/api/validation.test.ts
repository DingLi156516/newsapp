import { storiesQuerySchema, sourcesQuerySchema, parseSearchParams } from '@/lib/api/validation'

describe('storiesQuerySchema', () => {
  it('returns defaults when no params provided', () => {
    const result = storiesQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it('parses valid topic', () => {
    const result = storiesQuerySchema.safeParse({ topic: 'technology' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.topic).toBe('technology')
    }
  })

  it('rejects invalid topic', () => {
    const result = storiesQuerySchema.safeParse({ topic: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('coerces page and limit to numbers', () => {
    const result = storiesQuerySchema.safeParse({ page: '3', limit: '10' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.limit).toBe(10)
    }
  })

  it('rejects limit exceeding maximum', () => {
    const result = storiesQuerySchema.safeParse({ limit: '100' })
    expect(result.success).toBe(false)
  })

  it('parses blindspot filter', () => {
    const result = storiesQuerySchema.safeParse({ blindspot: 'true' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.blindspot).toBe('true')
    }
  })
})

describe('sourcesQuerySchema', () => {
  it('returns defaults when no params provided', () => {
    const result = sourcesQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(50)
    }
  })

  it('parses valid bias filter', () => {
    const result = sourcesQuerySchema.safeParse({ bias: 'lean-left' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.bias).toBe('lean-left')
    }
  })

  it('rejects invalid ownership', () => {
    const result = sourcesQuerySchema.safeParse({ ownership: 'alien' })
    expect(result.success).toBe(false)
  })
})

describe('storiesQuerySchema advanced filters', () => {
  it('parses valid biasRange', () => {
    const result = storiesQuerySchema.safeParse({ biasRange: 'left,center,right' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.biasRange).toBe('left,center,right')
    }
  })

  it('rejects biasRange exceeding max length', () => {
    const result = storiesQuerySchema.safeParse({ biasRange: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('rejects biasRange with invalid bias values', () => {
    const result = storiesQuerySchema.safeParse({ biasRange: 'left,invalid,center' })
    expect(result.success).toBe(false)
  })

  it('parses valid minFactuality', () => {
    const result = storiesQuerySchema.safeParse({ minFactuality: 'high' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.minFactuality).toBe('high')
    }
  })

  it('rejects invalid minFactuality', () => {
    const result = storiesQuerySchema.safeParse({ minFactuality: 'super-high' })
    expect(result.success).toBe(false)
  })

  it('parses valid datePreset', () => {
    const result = storiesQuerySchema.safeParse({ datePreset: '7d' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.datePreset).toBe('7d')
    }
  })

  it('rejects invalid datePreset', () => {
    const result = storiesQuerySchema.safeParse({ datePreset: '2w' })
    expect(result.success).toBe(false)
  })
})

describe('parseSearchParams', () => {
  it('returns parsed data for valid params', () => {
    const params = new URLSearchParams({ topic: 'health', page: '2' })
    const result = parseSearchParams(params, storiesQuerySchema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.topic).toBe('health')
      expect(result.data.page).toBe(2)
    }
  })

  it('returns error for invalid params', () => {
    const params = new URLSearchParams({ topic: 'nonsense' })
    const result = parseSearchParams(params, storiesQuerySchema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('topic')
    }
  })
})
