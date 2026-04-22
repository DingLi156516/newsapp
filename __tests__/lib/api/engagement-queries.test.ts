import { describe, it, expect, vi } from 'vitest'
import {
  insertStoryViewEvent,
  queryUniqueViewersForStory,
  queryTopEngagedStories,
  queryReadThroughStoryIds,
} from '@/lib/api/engagement-queries'

function createMockClient() {
  const chain = {
    insert: vi.fn().mockResolvedValue({ error: null }),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
  return {
    from: vi.fn(() => chain),
    _chain: chain,
  }
}

describe('insertStoryViewEvent', () => {
  it('inserts a row', async () => {
    const c = createMockClient()
    await insertStoryViewEvent(c as never, {
      story_id: 's1',
      session_id: 'sess',
      action: 'view',
      client: 'web',
    })
    expect(c.from).toHaveBeenCalledWith('story_views')
    expect(c._chain.insert).toHaveBeenCalled()
  })

  it('swallows unique-violation (dedupe)', async () => {
    const c = createMockClient()
    c._chain.insert.mockResolvedValue({ error: { code: '23505', message: 'dup' } })
    await expect(
      insertStoryViewEvent(c as never, {
        story_id: 's1',
        session_id: 'sess',
        action: 'view',
        client: 'web',
      })
    ).resolves.toBeUndefined()
  })

  it('throws on other errors', async () => {
    const c = createMockClient()
    c._chain.insert.mockResolvedValue({ error: { code: '42703', message: 'oops' } })
    await expect(
      insertStoryViewEvent(c as never, {
        story_id: 's1',
        session_id: 'sess',
        action: 'view',
        client: 'web',
      })
    ).rejects.toThrow(/oops/)
  })
})

describe('queryUniqueViewersForStory', () => {
  it('counts distinct sessions only', async () => {
    const c = createMockClient()
    c._chain.gte.mockResolvedValue({
      data: [{ session_id: 'a' }, { session_id: 'a' }, { session_id: 'b' }],
      error: null,
    })
    const r = await queryUniqueViewersForStory(c as never, 's1', 6)
    expect(r.uniqueViewers).toBe(2)
    expect(r.storyId).toBe('s1')
  })

  it('returns 0 when no rows', async () => {
    const c = createMockClient()
    c._chain.gte.mockResolvedValue({ data: [], error: null })
    const r = await queryUniqueViewersForStory(c as never, 's1', 6)
    expect(r.uniqueViewers).toBe(0)
  })

  it('throws on error', async () => {
    const c = createMockClient()
    c._chain.gte.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(queryUniqueViewersForStory(c as never, 's1', 6)).rejects.toThrow(/boom/)
  })
})

describe('queryTopEngagedStories', () => {
  it('returns stories sorted by unique-viewer count desc', async () => {
    const c = createMockClient()
    c._chain.gte.mockResolvedValue({
      data: [
        { story_id: 'a', session_id: 's1' },
        { story_id: 'a', session_id: 's2' },
        { story_id: 'b', session_id: 's1' },
        { story_id: 'b', session_id: 's1' },
        { story_id: 'c', session_id: 's1' },
        { story_id: 'c', session_id: 's2' },
        { story_id: 'c', session_id: 's3' },
      ],
      error: null,
    })
    const r = await queryTopEngagedStories(c as never, 6, 5)
    expect(r.map((x) => x.storyId)).toEqual(['c', 'a', 'b'])
    expect(r[0].uniqueViewers).toBe(3)
    expect(r[2].uniqueViewers).toBe(1)
  })

  it('respects the limit', async () => {
    const c = createMockClient()
    c._chain.gte.mockResolvedValue({
      data: [
        { story_id: 'a', session_id: 's1' },
        { story_id: 'b', session_id: 's2' },
        { story_id: 'c', session_id: 's3' },
      ],
      error: null,
    })
    const r = await queryTopEngagedStories(c as never, 6, 2)
    expect(r).toHaveLength(2)
  })
})

describe('queryReadThroughStoryIds', () => {
  it('returns deduped story IDs for the user', async () => {
    const c = createMockClient()
    c._chain.gte.mockResolvedValue({
      data: [{ story_id: 'x' }, { story_id: 'x' }, { story_id: 'y' }],
      error: null,
    })
    const r = await queryReadThroughStoryIds(c as never, 'u1', 14)
    expect(new Set(r)).toEqual(new Set(['x', 'y']))
  })
})
