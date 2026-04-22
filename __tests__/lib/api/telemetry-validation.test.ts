import { describe, it, expect } from 'vitest'
import { storyViewEventSchema } from '@/lib/api/telemetry-validation'

const STORY_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('storyViewEventSchema', () => {
  it('accepts a minimal view event', () => {
    const parsed = storyViewEventSchema.safeParse({
      storyId: STORY_ID,
      action: 'view',
      client: 'web',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts a dwell event with bucket', () => {
    const parsed = storyViewEventSchema.safeParse({
      storyId: STORY_ID,
      action: 'dwell',
      dwellBucket: 2,
      client: 'mobile',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects a dwell event without dwellBucket', () => {
    const parsed = storyViewEventSchema.safeParse({
      storyId: STORY_ID,
      action: 'dwell',
      client: 'mobile',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects an invalid storyId', () => {
    const parsed = storyViewEventSchema.safeParse({
      storyId: 'not-a-uuid',
      action: 'view',
      client: 'web',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects an out-of-range dwell bucket', () => {
    const parsed = storyViewEventSchema.safeParse({
      storyId: STORY_ID,
      action: 'dwell',
      dwellBucket: 4,
      client: 'web',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects an unknown action', () => {
    const parsed = storyViewEventSchema.safeParse({
      storyId: STORY_ID,
      action: 'wat',
      client: 'web',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects an unknown referrer kind', () => {
    const parsed = storyViewEventSchema.safeParse({
      storyId: STORY_ID,
      action: 'view',
      referrerKind: 'mystery',
      client: 'web',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects an unknown client', () => {
    const parsed = storyViewEventSchema.safeParse({
      storyId: STORY_ID,
      action: 'view',
      client: 'desktop',
    })
    expect(parsed.success).toBe(false)
  })
})
