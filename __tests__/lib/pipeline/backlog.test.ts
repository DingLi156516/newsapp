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
})
