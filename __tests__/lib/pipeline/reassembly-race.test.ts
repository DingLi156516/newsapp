/**
 * Tests for lib/pipeline/reassembly.ts guarded reassembly transitions.
 *
 * These tests exercise the scenario where a recluster/requeue caller
 * competes with a running assembler for a story. The expected behavior:
 * if the story is currently `assembly_status = 'processing'`, the
 * requeue RPC returns false and the caller logs a soft "guarded" entry.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  fetchAssemblyVersions,
  requeueStoryForReassembly,
  bumpAssemblyVersion,
} from '@/lib/pipeline/reassembly'

function createStateClient(
  stories: Array<{ id: string; assembly_version: number; assembly_status: string }>
) {
  const rpc = vi.fn((name: string, args: Record<string, unknown>) => {
    if (name === 'requeue_story_for_reassembly') {
      const storyId = args.p_story_id as string
      const expected = args.p_expected_version as number
      const story = stories.find((s) => s.id === storyId)
      if (!story) return Promise.resolve({ data: false, error: null })
      if (story.assembly_status === 'processing') {
        // Guarded: assembler is currently running on this story.
        return Promise.resolve({ data: false, error: null })
      }
      if (story.assembly_version !== expected) {
        // Version mismatch — another requeue already won.
        return Promise.resolve({ data: false, error: null })
      }
      story.assembly_version += 1
      story.assembly_status = 'pending'
      return Promise.resolve({ data: true, error: null })
    }
    if (name === 'bump_assembly_version') {
      const storyId = args.p_story_id as string
      const story = stories.find((s) => s.id === storyId)
      if (story) story.assembly_version += 1
      return Promise.resolve({ data: null, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })

  const from = vi.fn().mockImplementation(() => ({
    select: vi.fn((columns: string) => {
      if (columns === 'id, assembly_version, assembly_status') {
        return {
          in: vi.fn((_col: string, ids: string[]) =>
            Promise.resolve({
              data: stories
                .filter((s) => ids.includes(s.id))
                .map((s) => ({
                  id: s.id,
                  assembly_version: s.assembly_version,
                  assembly_status: s.assembly_status,
                })),
              error: null,
            })
          ),
        }
      }
      return {}
    }),
  }))

  return { rpc, from, _stories: stories }
}

describe('guarded reassembly', () => {
  it('requeues a completed story when version matches', async () => {
    const client = createStateClient([
      { id: 'story-1', assembly_version: 5, assembly_status: 'completed' },
    ])

    const versions = await fetchAssemblyVersions(client as never, ['story-1'])
    const expected = versions.get('story-1')!
    const result = await requeueStoryForReassembly(client as never, 'story-1', expected)

    expect(result).toBe(true)
    expect(client._stories[0].assembly_status).toBe('pending')
    expect(client._stories[0].assembly_version).toBe(6)
  })

  it('guards against requeue of a story currently being assembled', async () => {
    const client = createStateClient([
      { id: 'story-1', assembly_version: 5, assembly_status: 'processing' },
    ])

    const versions = await fetchAssemblyVersions(client as never, ['story-1'])
    const expected = versions.get('story-1')!
    const result = await requeueStoryForReassembly(client as never, 'story-1', expected)

    expect(result).toBe(false)
    // State is untouched — running assembler continues normally.
    expect(client._stories[0].assembly_status).toBe('processing')
    expect(client._stories[0].assembly_version).toBe(5)
  })

  it('version-mismatch requeue loses the race to the version bump', async () => {
    const client = createStateClient([
      { id: 'story-1', assembly_version: 5, assembly_status: 'completed' },
    ])

    // Caller A reads version=5 but does NOT call the RPC yet.
    const versionsA = await fetchAssemblyVersions(client as never, ['story-1'])
    const expectedA = versionsA.get('story-1')!

    // Caller B reads version=5 AND calls the RPC first → wins, bumps to 6.
    const versionsB = await fetchAssemblyVersions(client as never, ['story-1'])
    const expectedB = versionsB.get('story-1')!
    const resultB = await requeueStoryForReassembly(client as never, 'story-1', expectedB)
    expect(resultB).toBe(true)

    // Caller A now calls the RPC with its stale version=5 — fails.
    const resultA = await requeueStoryForReassembly(client as never, 'story-1', expectedA)
    expect(resultA).toBe(false)
    // Version stays at 6 (bumped once by B).
    expect(client._stories[0].assembly_version).toBe(6)
  })

  it('bumpAssemblyVersion increments without changing state', async () => {
    const client = createStateClient([
      { id: 'story-1', assembly_version: 5, assembly_status: 'completed' },
    ])

    await bumpAssemblyVersion(client as never, 'story-1')

    expect(client._stories[0].assembly_version).toBe(6)
    expect(client._stories[0].assembly_status).toBe('completed')
  })

  it('post-bump, a requeue caller with the old version is rejected', async () => {
    const client = createStateClient([
      { id: 'story-1', assembly_version: 5, assembly_status: 'completed' },
    ])

    // Requeue caller reads version=5.
    const versions = await fetchAssemblyVersions(client as never, ['story-1'])
    const expected = versions.get('story-1')!

    // Assembler completes a subsequent run and bumps to 6.
    await bumpAssemblyVersion(client as never, 'story-1')

    // Stale requeue caller tries to reset — must be rejected.
    const result = await requeueStoryForReassembly(client as never, 'story-1', expected)
    expect(result).toBe(false)
  })

  it('propagates p_clear_content=false by default (automated requeue paths)', async () => {
    const client = createStateClient([
      { id: 'story-1', assembly_version: 5, assembly_status: 'completed' },
    ])

    await requeueStoryForReassembly(client as never, 'story-1', 5)

    expect(client.rpc).toHaveBeenCalledWith(
      'requeue_story_for_reassembly',
      expect.objectContaining({
        p_story_id: 'story-1',
        p_expected_version: 5,
        p_clear_content: false,
      })
    )
  })

  it('propagates p_clear_content=true for admin reprocess path', async () => {
    const client = createStateClient([
      { id: 'story-1', assembly_version: 5, assembly_status: 'completed' },
    ])

    await requeueStoryForReassembly(client as never, 'story-1', 5, true)

    expect(client.rpc).toHaveBeenCalledWith(
      'requeue_story_for_reassembly',
      expect.objectContaining({
        p_story_id: 'story-1',
        p_expected_version: 5,
        p_clear_content: true,
      })
    )
  })
})
