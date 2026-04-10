/**
 * Tests for lib/pipeline/dead-letter.ts — DLQ replay fail-closed semantics.
 *
 * The Phase 7b remediation tightened replayDeadLetterEntry so that a
 * guarded requeue miss (story is currently being assembled or its
 * assembly_version moved) no longer silently marks the DLQ row replayed.
 * These tests pin that behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  replayDeadLetterEntry,
  listUnreplayed,
  pushToDeadLetter,
  dismissDeadLetterEntry,
} from '@/lib/pipeline/dead-letter'

interface MockDlqRow {
  id: string
  item_kind: 'article_embed' | 'article_cluster' | 'story_assemble'
  item_id: string
  retry_count: number
  last_error: string
  replayed_at: string | null
  failed_at: string
}

function createClient(
  dlqRows: MockDlqRow[],
  options: {
    storyGuarded?: boolean
    storyMissing?: boolean
    assemblyVersion?: number
  } = {}
) {
  const markedReplayed: string[] = []
  const articleUpdates: Array<{ id: string; payload: Record<string, unknown> }> = []
  const storyUpdates: Array<{ id: string; payload: Record<string, unknown> }> = []

  const rpc = vi.fn((name: string, args: Record<string, unknown>) => {
    if (name === 'requeue_story_for_reassembly') {
      if (options.storyGuarded) return Promise.resolve({ data: false, error: null })
      return Promise.resolve({ data: true, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })

  // Track every chained call. Each table needs select/update/insert paths.
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'pipeline_dead_letter') {
      return {
        select: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockImplementation((_col: string, id: string) => ({
            single: vi.fn().mockResolvedValue({
              data: dlqRows.find((r) => r.id === id) ?? null,
              error: dlqRows.find((r) => r.id === id) ? null : { message: 'not found' },
            }),
          })),
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: dlqRows.filter((r) => r.replayed_at === null),
                error: null,
              }),
            }),
          }),
        })),
        update: vi.fn().mockImplementation((payload: Record<string, unknown>) => ({
          eq: vi.fn().mockImplementation((_col: string, id: string) => {
            if ('replayed_at' in payload) {
              markedReplayed.push(id)
              const row = dlqRows.find((r) => r.id === id)
              if (row) row.replayed_at = payload.replayed_at as string
            }
            return Promise.resolve({ error: null })
          }),
        })),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }
    }

    if (table === 'articles') {
      return {
        update: vi.fn().mockImplementation((payload: Record<string, unknown>) => ({
          eq: vi.fn().mockImplementation((_col: string, id: string) => {
            articleUpdates.push({ id, payload })
            return Promise.resolve({ error: null })
          }),
        })),
      }
    }

    if (table === 'stories') {
      return {
        select: vi.fn().mockImplementation(() => ({
          in: vi.fn().mockImplementation((_col: string, ids: string[]) =>
            Promise.resolve({
              data: options.storyMissing
                ? []
                : ids.map((id) => ({
                    id,
                    assembly_version: options.assemblyVersion ?? 3,
                    assembly_status: options.storyGuarded ? 'processing' : 'completed',
                  })),
              error: null,
            })
          ),
        })),
        update: vi.fn().mockImplementation((payload: Record<string, unknown>) => ({
          eq: vi.fn().mockImplementation((_col: string, id: string) => {
            storyUpdates.push({ id, payload })
            return Promise.resolve({ error: null })
          }),
        })),
      }
    }

    return {}
  })

  return {
    client: { from, rpc } as never,
    markedReplayed,
    articleUpdates,
    storyUpdates,
    rpc,
  }
}

describe('replayDeadLetterEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false when the DLQ entry does not exist', async () => {
    const { client, markedReplayed } = createClient([])

    const result = await replayDeadLetterEntry(client, 'missing-id')

    expect(result).toBe(false)
    expect(markedReplayed).toEqual([])
  })

  it('resets an article_embed entry and marks the DLQ row replayed', async () => {
    const { client, articleUpdates, markedReplayed } = createClient([
      {
        id: 'dlq-1',
        item_kind: 'article_embed',
        item_id: 'article-1',
        retry_count: 6,
        last_error: 'boom',
        replayed_at: null,
        failed_at: '2026-03-20T00:00:00Z',
      },
    ])

    const result = await replayDeadLetterEntry(client, 'dlq-1')

    expect(result).toBe(true)
    expect(articleUpdates).toHaveLength(1)
    expect(articleUpdates[0].id).toBe('article-1')
    expect(articleUpdates[0].payload).toMatchObject({
      embedding_retry_count: 0,
      embedding_next_attempt_at: null,
      embedding_last_error: null,
      embedding_claimed_at: null,
      embedding_claim_owner: null,
    })
    expect(markedReplayed).toEqual(['dlq-1'])
  })

  it('resets an article_cluster entry and flips clustering_status back to pending', async () => {
    const { client, articleUpdates, markedReplayed } = createClient([
      {
        id: 'dlq-2',
        item_kind: 'article_cluster',
        item_id: 'article-2',
        retry_count: 6,
        last_error: 'cluster boom',
        replayed_at: null,
        failed_at: '2026-03-20T00:00:00Z',
      },
    ])

    const result = await replayDeadLetterEntry(client, 'dlq-2')

    expect(result).toBe(true)
    expect(articleUpdates[0].payload).toMatchObject({
      clustering_retry_count: 0,
      clustering_next_attempt_at: null,
      clustering_last_error: null,
      clustering_claimed_at: null,
      clustering_claim_owner: null,
      clustering_status: 'pending',
    })
    expect(markedReplayed).toEqual(['dlq-2'])
  })

  it('replays a story_assemble entry via the guarded requeue RPC', async () => {
    const { client, rpc, markedReplayed } = createClient([
      {
        id: 'dlq-3',
        item_kind: 'story_assemble',
        item_id: 'story-3',
        retry_count: 4,
        last_error: 'assembly boom',
        replayed_at: null,
        failed_at: '2026-03-20T00:00:00Z',
      },
    ])

    const result = await replayDeadLetterEntry(client, 'dlq-3')

    expect(result).toBe(true)
    expect(rpc).toHaveBeenCalledWith(
      'requeue_story_for_reassembly',
      expect.objectContaining({ p_story_id: 'story-3' })
    )
    expect(markedReplayed).toEqual(['dlq-3'])
  })

  it('fails closed when the guarded requeue loses the race (Codex finding 3)', async () => {
    const { client, markedReplayed } = createClient(
      [
        {
          id: 'dlq-4',
          item_kind: 'story_assemble',
          item_id: 'story-4',
          retry_count: 4,
          last_error: 'assembly boom',
          replayed_at: null,
          failed_at: '2026-03-20T00:00:00Z',
        },
      ],
      { storyGuarded: true }
    )

    await expect(replayDeadLetterEntry(client, 'dlq-4')).rejects.toThrow(
      /currently being assembled or its assembly_version moved/
    )

    // The whole point of the remediation: the DLQ row must NOT be marked
    // replayed when the guarded requeue returned false. Otherwise the
    // evidence would vanish from the unreplayed queue without the
    // underlying story ever being reset.
    expect(markedReplayed).toEqual([])
  })

  it('throws a clear error when a story is missing assembly_version', async () => {
    const { client, markedReplayed } = createClient(
      [
        {
          id: 'dlq-5',
          item_kind: 'story_assemble',
          item_id: 'story-5',
          retry_count: 4,
          last_error: 'assembly boom',
          replayed_at: null,
          failed_at: '2026-03-20T00:00:00Z',
        },
      ],
      { storyMissing: true }
    )

    await expect(replayDeadLetterEntry(client, 'dlq-5')).rejects.toThrow(
      /has no assembly_version/
    )
    expect(markedReplayed).toEqual([])
  })
})

describe('listUnreplayed / pushToDeadLetter / dismissDeadLetterEntry', () => {
  it('lists only unreplayed entries', async () => {
    const { client } = createClient([
      {
        id: 'dlq-a',
        item_kind: 'article_embed',
        item_id: 'a1',
        retry_count: 6,
        last_error: 'x',
        replayed_at: null,
        failed_at: '2026-03-20T00:00:00Z',
      },
      {
        id: 'dlq-b',
        item_kind: 'article_embed',
        item_id: 'a2',
        retry_count: 6,
        last_error: 'y',
        replayed_at: '2026-03-21T00:00:00Z',
        failed_at: '2026-03-19T00:00:00Z',
      },
    ])

    const entries = await listUnreplayed(client)

    expect(entries.map((e) => e.id)).toEqual(['dlq-a'])
  })

  it('pushes a new entry without throwing', async () => {
    const { client } = createClient([])

    await expect(
      pushToDeadLetter(client, {
        itemKind: 'article_cluster',
        itemId: 'a1',
        retryCount: 6,
        lastError: 'fail',
      })
    ).resolves.not.toThrow()
  })

  it('dismissing an entry marks it replayed without resetting any row', async () => {
    const { client, markedReplayed, articleUpdates } = createClient([
      {
        id: 'dlq-z',
        item_kind: 'article_embed',
        item_id: 'a1',
        retry_count: 6,
        last_error: 'x',
        replayed_at: null,
        failed_at: '2026-03-20T00:00:00Z',
      },
    ])

    await dismissDeadLetterEntry(client, 'dlq-z')

    expect(markedReplayed).toEqual(['dlq-z'])
    // No reset of the underlying article — dismiss is explicitly a
    // "drop without retry" operation.
    expect(articleUpdates).toEqual([])
  })
})
