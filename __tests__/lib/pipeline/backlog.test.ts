import { describe, it, expect, vi } from 'vitest'
import { countPipelineBacklog } from '@/lib/pipeline/backlog'

function createCountBuilder(count: number) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve: (value: unknown) => void) => {
      resolve({ count, error: null })
      return Promise.resolve({ count, error: null })
    }),
  }
  Object.defineProperty(builder, Symbol.toStringTag, { value: 'Promise' })
  return builder
}

function createOldestBuilder(column: string, value: string | null) {
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve: (result: unknown) => void) => {
      const result = {
        data: value === null ? [] : [{ [column]: value }],
        error: null,
      }
      resolve(result)
      return Promise.resolve(result)
    }),
  }
}

describe('countPipelineBacklog', () => {
  it('returns counts for each pipeline stage', async () => {
    const builders = [
      createCountBuilder(11),
      createCountBuilder(7),
      createCountBuilder(3),
      createCountBuilder(5),
      createCountBuilder(2),
    ]
    const client = {
      from: vi.fn(() => builders.shift()),
    }

    const backlog = await countPipelineBacklog(client as never)

    expect(backlog).toEqual({
      unembeddedArticles: 11,
      unclusteredArticles: 7,
      pendingAssemblyStories: 3,
      reviewQueueStories: 5,
      expiredArticles: 2,
    })
  })

  it('filters unclustered count to pending clustering_status only', async () => {
    const builders = [
      createCountBuilder(0),
      createCountBuilder(4),
      createCountBuilder(0),
      createCountBuilder(0),
      createCountBuilder(0),
    ]
    const client = {
      from: vi.fn(() => builders.shift()),
    }

    const backlog = await countPipelineBacklog(client as never)

    // Second from() call is the unclustered query
    const unclusteredBuilder = client.from.mock.results[1].value
    expect(unclusteredBuilder.eq).toHaveBeenCalledWith('clustering_status', 'pending')
    expect(backlog.unclusteredArticles).toBe(4)
  })

  it('skips oldest-age queries by default', async () => {
    const builders = [
      createCountBuilder(11),
      createCountBuilder(7),
      createCountBuilder(3),
      createCountBuilder(5),
      createCountBuilder(2),
    ]
    const client = {
      from: vi.fn(() => builders.shift()),
    }

    const backlog = await countPipelineBacklog(client as never)

    expect(client.from).toHaveBeenCalledTimes(5)
    expect(backlog.oldestAgeMinutes).toBeUndefined()
  })

  it('includes oldest-age queries when explicitly requested', async () => {
    const builders = [
      createCountBuilder(11),
      createCountBuilder(7),
      createCountBuilder(3),
      createCountBuilder(5),
      createCountBuilder(2),
      createOldestBuilder('created_at', '2026-03-22T11:30:00Z'),
      createOldestBuilder('created_at', '2026-03-22T11:40:00Z'),
      createOldestBuilder('last_updated', '2026-03-22T11:55:00Z'),
      createOldestBuilder('last_updated', '2026-03-22T11:20:00Z'),
      createOldestBuilder('published_at', '2026-03-22T10:00:00Z'),
    ]
    const client = {
      from: vi.fn(() => builders.shift()),
    }

    const backlog = await countPipelineBacklog(client as never, { includeAges: true })

    expect(client.from).toHaveBeenCalledTimes(10)
    expect(backlog.oldestAgeMinutes).toEqual({
      unembeddedArticles: expect.any(Number),
      unclusteredArticles: expect.any(Number),
      pendingAssemblyStories: expect.any(Number),
      reviewQueueStories: expect.any(Number),
      expiredArticles: expect.any(Number),
    })

    const pendingAssemblyBuilder = client.from.mock.results[7].value
    expect(pendingAssemblyBuilder.select).toHaveBeenCalledWith('last_updated')
  })
})
