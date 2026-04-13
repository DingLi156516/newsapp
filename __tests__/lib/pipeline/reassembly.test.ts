/**
 * Tests for lib/pipeline/reassembly.ts — Guarded reassembly transitions.
 *
 * Unit-level tests for fetchAssemblyVersions, requeueStoryForReassembly,
 * and bumpAssemblyVersion with mock Supabase client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchAssemblyVersions,
  requeueStoryForReassembly,
  bumpAssemblyVersion,
} from '@/lib/pipeline/reassembly'

beforeEach(() => {
  vi.clearAllMocks()
})

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Build a mock client whose `.from('stories').select(...).in(...)` chain
 * resolves to { data, error }.
 */
function makeQueryClient(opts: {
  data?: Array<{ id: string; assembly_version: unknown; assembly_status?: string }> | null
  error?: { message: string } | null
}) {
  const inFn = vi.fn().mockResolvedValue({
    data: opts.data ?? null,
    error: opts.error ?? null,
  })
  const selectFn = vi.fn().mockReturnValue({ in: inFn })
  const fromFn = vi.fn().mockReturnValue({ select: selectFn })

  return {
    from: fromFn,
    _spies: { fromFn, selectFn, inFn },
  } as never
}

/** Build a mock client whose `.rpc(name, args)` returns { data, error }. */
function makeRpcClient(opts: {
  data?: unknown
  error?: { message: string } | null
}) {
  const rpc = vi.fn().mockResolvedValue({
    data: opts.data ?? null,
    error: opts.error ?? null,
  })
  return { rpc, _rpc: rpc } as never
}

/* ------------------------------------------------------------------ */
/*  fetchAssemblyVersions                                              */
/* ------------------------------------------------------------------ */
describe('fetchAssemblyVersions', () => {
  it('returns empty Map for empty storyIds without querying', async () => {
    const fromFn = vi.fn()
    const client = { from: fromFn } as never

    const result = await fetchAssemblyVersions(client, [])

    expect(result).toEqual(new Map())
    expect(fromFn).not.toHaveBeenCalled()
  })

  it('returns Map with id to version entries', async () => {
    const client = makeQueryClient({
      data: [
        { id: 's1', assembly_version: 3, assembly_status: 'pending' },
        { id: 's2', assembly_version: 7, assembly_status: 'complete' },
      ],
    })

    const result = await fetchAssemblyVersions(client, ['s1', 's2'])

    expect(result.size).toBe(2)
    expect(result.get('s1')).toBe(3)
    expect(result.get('s2')).toBe(7)
  })

  it('omits rows where assembly_version is not a number', async () => {
    const client = makeQueryClient({
      data: [
        { id: 's1', assembly_version: 5 },
        { id: 's2', assembly_version: null },
        { id: 's3', assembly_version: 'invalid' },
        { id: 's4', assembly_version: undefined },
      ],
    })

    const result = await fetchAssemblyVersions(client, ['s1', 's2', 's3', 's4'])

    expect(result.size).toBe(1)
    expect(result.get('s1')).toBe(5)
    expect(result.has('s2')).toBe(false)
    expect(result.has('s3')).toBe(false)
    expect(result.has('s4')).toBe(false)
  })

  it('handles null data gracefully (returns empty map)', async () => {
    const client = makeQueryClient({ data: null })

    const result = await fetchAssemblyVersions(client, ['s1'])

    expect(result.size).toBe(0)
  })

  it('throws on query error', async () => {
    const client = makeQueryClient({
      error: { message: 'connection refused' },
    })

    await expect(
      fetchAssemblyVersions(client, ['s1'])
    ).rejects.toThrow('Failed to fetch assembly versions: connection refused')
  })

  it('passes correct select columns and filter', async () => {
    const inFn = vi.fn().mockResolvedValue({ data: [], error: null })
    const selectFn = vi.fn().mockReturnValue({ in: inFn })
    const fromFn = vi.fn().mockReturnValue({ select: selectFn })
    const client = { from: fromFn } as never

    await fetchAssemblyVersions(client, ['s1', 's2'])

    expect(fromFn).toHaveBeenCalledWith('stories')
    expect(selectFn).toHaveBeenCalledWith('id, assembly_version, assembly_status')
    expect(inFn).toHaveBeenCalledWith('id', ['s1', 's2'])
  })
})

/* ------------------------------------------------------------------ */
/*  requeueStoryForReassembly                                          */
/* ------------------------------------------------------------------ */
describe('requeueStoryForReassembly', () => {
  it('returns true when RPC data is true (CAS success)', async () => {
    const client = makeRpcClient({ data: true })

    const result = await requeueStoryForReassembly(client, 'story-1', 5)

    expect(result).toBe(true)
  })

  it('returns false when RPC data is false (version mismatch)', async () => {
    const client = makeRpcClient({ data: false })

    const result = await requeueStoryForReassembly(client, 'story-1', 5)

    expect(result).toBe(false)
  })

  it('passes clearContent=false by default', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    const client = { rpc } as never

    await requeueStoryForReassembly(client, 'story-1', 3)

    expect(rpc).toHaveBeenCalledWith('requeue_story_for_reassembly', {
      p_story_id: 'story-1',
      p_expected_version: 3,
      p_clear_content: false,
    })
  })

  it('passes clearContent=true when specified', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    const client = { rpc } as never

    await requeueStoryForReassembly(client, 'story-1', 3, true)

    expect(rpc).toHaveBeenCalledWith('requeue_story_for_reassembly', {
      p_story_id: 'story-1',
      p_expected_version: 3,
      p_clear_content: true,
    })
  })

  it('throws on RPC error', async () => {
    const client = makeRpcClient({
      error: { message: 'timeout' },
    })

    await expect(
      requeueStoryForReassembly(client, 'story-1', 5)
    ).rejects.toThrow('Failed to requeue story story-1: timeout')
  })
})

/* ------------------------------------------------------------------ */
/*  bumpAssemblyVersion                                                */
/* ------------------------------------------------------------------ */
describe('bumpAssemblyVersion', () => {
  it('calls RPC with correct storyId', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const client = { rpc } as never

    await bumpAssemblyVersion(client, 'story-42')

    expect(rpc).toHaveBeenCalledWith('bump_assembly_version', {
      p_story_id: 'story-42',
    })
  })

  it('does not throw on success', async () => {
    const client = makeRpcClient({ data: null })

    await expect(bumpAssemblyVersion(client, 'story-1')).resolves.toBeUndefined()
  })

  it('logs warning on error but does not throw', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = makeRpcClient({
      error: { message: 'network error' },
    })

    await expect(bumpAssemblyVersion(client, 'story-1')).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to bump assembly_version for story-1: network error'
    )

    warnSpy.mockRestore()
  })
})
