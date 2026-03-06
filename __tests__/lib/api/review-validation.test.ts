import { describe, it, expect } from 'vitest'
import {
  reviewActionSchema,
  reviewQueueQuerySchema,
} from '@/lib/api/review-validation'

describe('reviewActionSchema', () => {
  it('accepts approve action', () => {
    const result = reviewActionSchema.safeParse({ action: 'approve' })
    expect(result.success).toBe(true)
  })

  it('accepts reject action', () => {
    const result = reviewActionSchema.safeParse({ action: 'reject' })
    expect(result.success).toBe(true)
  })

  it('accepts reprocess action', () => {
    const result = reviewActionSchema.safeParse({ action: 'reprocess' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid action', () => {
    const result = reviewActionSchema.safeParse({ action: 'delete' })
    expect(result.success).toBe(false)
  })

  it('accepts approve with headline and summary edits', () => {
    const result = reviewActionSchema.safeParse({
      action: 'approve',
      headline: 'Updated Headline',
      ai_summary: {
        commonGround: 'Updated common ground',
        leftFraming: 'Updated left framing',
        rightFraming: 'Updated right framing',
      },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.headline).toBe('Updated Headline')
      expect(result.data.ai_summary?.commonGround).toBe('Updated common ground')
    }
  })

  it('rejects empty headline', () => {
    const result = reviewActionSchema.safeParse({
      action: 'approve',
      headline: '',
    })
    expect(result.success).toBe(false)
  })

  it('allows omitting optional fields', () => {
    const result = reviewActionSchema.safeParse({ action: 'approve' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.headline).toBeUndefined()
      expect(result.data.ai_summary).toBeUndefined()
    }
  })
})

describe('reviewQueueQuerySchema', () => {
  it('defaults to page 1 and limit 20', () => {
    const result = reviewQueueQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it('accepts status filter', () => {
    const result = reviewQueueQuerySchema.safeParse({ status: 'pending' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('pending')
    }
  })

  it('rejects invalid status', () => {
    const result = reviewQueueQuerySchema.safeParse({ status: 'deleted' })
    expect(result.success).toBe(false)
  })

  it('coerces page and limit from strings', () => {
    const result = reviewQueueQuerySchema.safeParse({ page: '3', limit: '10' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.limit).toBe(10)
    }
  })

  it('rejects page less than 1', () => {
    const result = reviewQueueQuerySchema.safeParse({ page: '0' })
    expect(result.success).toBe(false)
  })

  it('rejects limit greater than 50', () => {
    const result = reviewQueueQuerySchema.safeParse({ limit: '100' })
    expect(result.success).toBe(false)
  })
})
