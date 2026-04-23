import { describe, it, expect, vi } from 'vitest'
import { queryTopErrors } from '@/lib/api/pipeline-top-errors'

function makeClient(events: unknown[] | { error: { message: string } }) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    in: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => {
      if ('error' in (events as object) && (events as { error: unknown }).error) {
        return Promise.resolve({ data: null, error: (events as { error: { message: string } }).error })
      }
      return Promise.resolve({ data: events, error: null })
    }),
  }
  return { from: vi.fn(() => chain) }
}

describe('queryTopErrors', () => {
  it('groups events by (stage, event_type) and sorts by count', async () => {
    const events = [
      { stage: 'embed', event_type: 'gemini_error', created_at: '2026-04-23T10:00:00Z', payload: { msg: 'rate' }, run_id: 'r1' },
      { stage: 'embed', event_type: 'gemini_error', created_at: '2026-04-23T09:50:00Z', payload: { msg: 'rate' }, run_id: 'r1' },
      { stage: 'embed', event_type: 'gemini_error', created_at: '2026-04-23T09:30:00Z', payload: { msg: 'rate' }, run_id: 'r2' },
      { stage: 'cluster', event_type: 'cluster_drift', created_at: '2026-04-23T09:00:00Z', payload: {}, run_id: 'r2' },
    ]
    const client = makeClient(events)

    const result = await queryTopErrors(client as never)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      stage: 'embed',
      eventType: 'gemini_error',
      count: 3,
      lastSeen: '2026-04-23T10:00:00Z',
      firstSeen: '2026-04-23T09:30:00Z',
    })
    expect(result[1]).toMatchObject({ stage: 'cluster', eventType: 'cluster_drift', count: 1 })
  })

  it('returns empty when no events', async () => {
    const client = makeClient([])
    const result = await queryTopErrors(client as never)
    expect(result).toEqual([])
  })

  it('throws on query error', async () => {
    const client = makeClient({ error: { message: 'db down' } })
    await expect(queryTopErrors(client as never)).rejects.toThrow('Failed to load top errors: db down')
  })
})
