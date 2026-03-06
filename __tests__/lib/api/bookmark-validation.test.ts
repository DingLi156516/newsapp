import { describe, it, expect } from 'vitest'
import { bookmarkStoryIdSchema } from '@/lib/api/bookmark-validation'

describe('bookmarkStoryIdSchema', () => {
  it('accepts valid UUID', () => {
    const result = bookmarkStoryIdSchema.safeParse({
      storyId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID string', () => {
    const result = bookmarkStoryIdSchema.safeParse({ storyId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects missing storyId', () => {
    const result = bookmarkStoryIdSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects empty string', () => {
    const result = bookmarkStoryIdSchema.safeParse({ storyId: '' })
    expect(result.success).toBe(false)
  })
})
