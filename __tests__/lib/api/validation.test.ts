import { storiesQuerySchema, sourcesQuerySchema, tagsQuerySchema, parseSearchParams } from '@/lib/api/validation'

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

describe('storiesQuerySchema tag param', () => {
  it('parses valid tag slug', () => {
    const result = storiesQuerySchema.safeParse({ tag: 'iran-war' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tag).toBe('iran-war')
    }
  })

  it('accepts tag as optional', () => {
    const result = storiesQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tag).toBeUndefined()
    }
  })

  it('rejects tag exceeding max length', () => {
    const result = storiesQuerySchema.safeParse({ tag: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('accepts valid tag_type alongside tag', () => {
    const result = storiesQuerySchema.safeParse({ tag: 'jordan', tag_type: 'person' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tag_type).toBe('person')
    }
  })

  it('rejects invalid tag_type value', () => {
    const result = storiesQuerySchema.safeParse({ tag: 'jordan', tag_type: 'animal' })
    expect(result.success).toBe(false)
  })

  it('accepts tag_type as optional', () => {
    const result = storiesQuerySchema.safeParse({ tag: 'jordan' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tag_type).toBeUndefined()
    }
  })

  it('rejects tag_type without tag', () => {
    const result = storiesQuerySchema.safeParse({ tag_type: 'person' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('tag_type requires tag to be specified')
      expect(result.error.issues[0].path).toContain('tag_type')
    }
  })
})

describe('storiesQuerySchema owner param', () => {
  it('parses valid owner slug', () => {
    const result = storiesQuerySchema.safeParse({ owner: 'warner-bros-discovery' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.owner).toBe('warner-bros-discovery')
    }
  })

  it('accepts owner as optional', () => {
    const result = storiesQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.owner).toBeUndefined()
    }
  })

  it('rejects owner slug with uppercase characters', () => {
    const result = storiesQuerySchema.safeParse({ owner: 'Warner-Bros' })
    expect(result.success).toBe(false)
  })

  it('rejects owner slug starting with hyphen', () => {
    const result = storiesQuerySchema.safeParse({ owner: '-warner' })
    expect(result.success).toBe(false)
  })

  it('rejects owner slug with spaces or punctuation', () => {
    const result = storiesQuerySchema.safeParse({ owner: 'warner bros' })
    expect(result.success).toBe(false)
  })

  it('rejects owner slug exceeding 100 chars', () => {
    const result = storiesQuerySchema.safeParse({ owner: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })
})

describe('tagsQuerySchema', () => {
  it('returns defaults when no params provided', () => {
    const result = tagsQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(50)
    }
  })

  it('parses valid type filter', () => {
    const result = tagsQuerySchema.safeParse({ type: 'person' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe('person')
    }
  })

  it('rejects invalid type', () => {
    const result = tagsQuerySchema.safeParse({ type: 'animal' })
    expect(result.success).toBe(false)
  })

  it('parses search query', () => {
    const result = tagsQuerySchema.safeParse({ search: 'iran' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.search).toBe('iran')
    }
  })

  it('coerces page and limit', () => {
    const result = tagsQuerySchema.safeParse({ page: '2', limit: '25' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(2)
      expect(result.data.limit).toBe(25)
    }
  })

  it('rejects limit exceeding maximum', () => {
    const result = tagsQuerySchema.safeParse({ limit: '200' })
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
