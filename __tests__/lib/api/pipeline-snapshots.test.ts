import { describe, it, expect, vi } from 'vitest'
import { queryBacklogSnapshots } from '@/lib/api/pipeline-snapshots'

function makeClient(rows: unknown[] | { error: { message: string } }) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    order: vi.fn(() => {
      if ('error' in (rows as object)) {
        return Promise.resolve({ data: null, error: (rows as { error: { message: string } }).error })
      }
      return Promise.resolve({ data: rows, error: null })
    }),
  }
  return { from: vi.fn(() => chain) }
}

describe('queryBacklogSnapshots', () => {
  it('returns rows from supabase', async () => {
    const rows = [
      { captured_at: '2026-04-23T10:00:00Z', unembedded_count: 100, unclustered_count: 50, pending_assembly_count: 2, review_queue_count: 1, stale_claim_count: 0 },
    ]
    const client = makeClient(rows)
    const result = await queryBacklogSnapshots(client as never, 24)
    expect(result).toEqual(rows)
  })

  it('returns empty array when no data', async () => {
    const client = makeClient([])
    const result = await queryBacklogSnapshots(client as never)
    expect(result).toEqual([])
  })

  it('throws on query error', async () => {
    const client = makeClient({ error: { message: 'down' } })
    await expect(queryBacklogSnapshots(client as never)).rejects.toThrow(
      'Failed to load backlog snapshots: down'
    )
  })
})
