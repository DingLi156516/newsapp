/**
 * Tests for lib/admin/pipeline-maintenance.ts — operator-facing purges
 * backed by SECURITY DEFINER SQL functions in migration 047.
 *
 * Each purge:
 *   - Inserts an audit row BEFORE the RPC call
 *   - Invokes the RPC (with dry_run flag)
 *   - Collects returned ids and uses them as the truth for deleted_count
 *   - Finalizes the audit row (throws on failure)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  purgeUnembeddedArticles,
  purgeOrphanStories,
  purgeExpiredArticles,
} from '@/lib/admin/pipeline-maintenance'

interface MockClient {
  from: ReturnType<typeof vi.fn>
  rpc: ReturnType<typeof vi.fn>
}

interface Calls {
  insertArgs: unknown[]
  updateArgs: unknown[]
  updateEqArgs: unknown[][]
  rpcCalls: Array<[string, Record<string, unknown>]>
}

function makeClient(options: {
  rpcResult: { data: Array<{ deleted_id: string }> | null; error: { message: string } | null }
  insertError?: { message: string } | null
  updateError?: { message: string } | null
}): { client: MockClient; calls: Calls } {
  const calls: Calls = {
    insertArgs: [],
    updateArgs: [],
    updateEqArgs: [],
    rpcCalls: [],
  }

  const auditInsertBuilder = {
    insert: (payload: unknown) => {
      calls.insertArgs.push(payload)
      return {
        select: () => ({
          single: () =>
            Promise.resolve({
              data: options.insertError ? null : { id: 'audit-1' },
              error: options.insertError ?? null,
            }),
        }),
      }
    },
    update: (payload: unknown) => {
      calls.updateArgs.push(payload)
      return {
        eq: (...args: unknown[]) => {
          calls.updateEqArgs.push(args)
          return Promise.resolve({
            data: null,
            error: options.updateError ?? null,
          })
        },
      }
    },
  }

  const client: MockClient = {
    from: vi.fn().mockReturnValue(auditInsertBuilder),
    rpc: vi.fn().mockImplementation((name: string, args: Record<string, unknown>) => {
      calls.rpcCalls.push([name, args])
      return Promise.resolve(options.rpcResult)
    }),
  }

  return { client, calls }
}

describe('purgeUnembeddedArticles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('dry-run calls the RPC with p_dry_run=true and writes audit rows', async () => {
    const { client, calls } = makeClient({
      rpcResult: { data: [{ deleted_id: 'a1' }, { deleted_id: 'a2' }], error: null },
    })

    const result = await purgeUnembeddedArticles(client as never, {
      olderThanDays: 7,
      dryRun: true,
    })

    expect(result.deletedCount).toBe(2)
    expect(result.sampleIds).toEqual(['a1', 'a2'])
    expect(result.dryRun).toBe(true)
    expect(calls.rpcCalls).toHaveLength(1)
    const [name, args] = calls.rpcCalls[0]
    expect(name).toBe('purge_unembedded_articles_batch')
    expect(args).toEqual({ p_older_than_days: 7, p_limit: 1000, p_dry_run: true })
    expect(calls.insertArgs).toHaveLength(1)
    expect(calls.updateArgs).toHaveLength(1)
  })

  it('real run calls the RPC with p_dry_run=false and records accurate deleted_count', async () => {
    const { client, calls } = makeClient({
      rpcResult: { data: [{ deleted_id: 'a1' }, { deleted_id: 'a2' }, { deleted_id: 'a3' }], error: null },
    })

    const result = await purgeUnembeddedArticles(client as never, {
      olderThanDays: 7,
      dryRun: false,
    })

    expect(result.deletedCount).toBe(3)
    expect(result.dryRun).toBe(false)
    expect(calls.rpcCalls[0][1]).toEqual({
      p_older_than_days: 7,
      p_limit: 1000,
      p_dry_run: false,
    })
    // Audit update uses the actual RPC return count, not a pre-count.
    const patch = calls.updateArgs[0] as { deleted_count: number; completed_at: string }
    expect(patch.deleted_count).toBe(3)
    expect(patch.completed_at).toBeTruthy()
  })

  it('defaults olderThanDays to 7 when not supplied', async () => {
    const { client, calls } = makeClient({
      rpcResult: { data: [], error: null },
    })

    await purgeUnembeddedArticles(client as never, { dryRun: true })

    expect(calls.rpcCalls[0][1].p_older_than_days).toBe(7)
  })

  it('empty RPC result still writes an audit row', async () => {
    const { client, calls } = makeClient({
      rpcResult: { data: [], error: null },
    })

    const result = await purgeUnembeddedArticles(client as never, {
      olderThanDays: 7,
      dryRun: false,
    })

    expect(result.deletedCount).toBe(0)
    expect(calls.insertArgs).toHaveLength(1)
    expect(calls.updateArgs).toHaveLength(1)
  })

  it('throws when the RPC errors and records the error on the audit row', async () => {
    const { client, calls } = makeClient({
      rpcResult: { data: null, error: { message: 'db down' } },
    })

    await expect(
      purgeUnembeddedArticles(client as never, {
        olderThanDays: 7,
        dryRun: true,
      })
    ).rejects.toThrow(/db down/)

    // Audit row was updated with the error payload even on failure
    expect(calls.updateArgs).toHaveLength(1)
    const patch = calls.updateArgs[0] as { error: string }
    expect(patch.error).toBe('db down')
  })

  it('throws when the audit INSERT fails (no RPC invoked)', async () => {
    const { client, calls } = makeClient({
      rpcResult: { data: [], error: null },
      insertError: { message: 'rls denied' },
    })

    await expect(
      purgeUnembeddedArticles(client as never, {
        olderThanDays: 7,
        dryRun: true,
      })
    ).rejects.toThrow(/rls denied/)

    expect(calls.rpcCalls).toHaveLength(0)
  })

  it('throws when audit finalization fails (audit integrity guarantee)', async () => {
    const { client } = makeClient({
      rpcResult: { data: [{ deleted_id: 'a1' }], error: null },
      updateError: { message: 'finalize crash' },
    })

    await expect(
      purgeUnembeddedArticles(client as never, {
        olderThanDays: 7,
        dryRun: false,
      })
    ).rejects.toThrow(/maintenance_audit finalize failed/)
  })

  it('surfaces both the RPC error AND the finalize failure as a composite error', async () => {
    const { client } = makeClient({
      rpcResult: { data: null, error: { message: 'rpc down' } },
      updateError: { message: 'finalize also down' },
    })

    await expect(
      purgeUnembeddedArticles(client as never, {
        olderThanDays: 7,
        dryRun: true,
      })
    ).rejects.toThrow(/rpc down.*additionally.*finalize also down/i)
  })
})

describe('purgeOrphanStories', () => {
  beforeEach(() => vi.clearAllMocks())

  it('dispatches purge_orphan_stories_batch with the right args', async () => {
    const { client, calls } = makeClient({
      rpcResult: { data: [{ deleted_id: 's1' }], error: null },
    })

    const result = await purgeOrphanStories(client as never, { dryRun: false })

    expect(result.deletedCount).toBe(1)
    expect(calls.rpcCalls[0]).toEqual([
      'purge_orphan_stories_batch',
      { p_limit: 1000, p_dry_run: false },
    ])
  })
})

describe('purgeExpiredArticles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('dispatches purge_expired_articles_batch with the right args', async () => {
    const { client, calls } = makeClient({
      rpcResult: { data: [{ deleted_id: 'a1' }, { deleted_id: 'a2' }], error: null },
    })

    const result = await purgeExpiredArticles(client as never, { dryRun: true })

    expect(result.deletedCount).toBe(2)
    expect(calls.rpcCalls[0]).toEqual([
      'purge_expired_articles_batch',
      { p_limit: 1000, p_dry_run: true },
    ])
  })
})
