/**
 * Tests for lib/pipeline/cluster-writes.ts — Transactional cluster write helpers.
 *
 * Covers createStoryWithArticles (success, empty articles, null owner,
 * ownership_moved P0010, generic error, unexpected data), mergeStories
 * (success, error), and deleteEmptyStory (success, error).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createStoryWithArticles,
  mergeStories,
  deleteEmptyStory,
} from '@/lib/pipeline/cluster-writes'
import type { StoryCreatePayload } from '@/lib/pipeline/cluster-writes'

function makeClient(rpcImpl: ReturnType<typeof vi.fn>) {
  return { rpc: rpcImpl } as never
}

const SAMPLE_STORY: StoryCreatePayload = {
  headline: 'Test headline',
  story_kind: 'standard',
  topic: 'politics',
  source_count: 3,
  image_url: null,
  cluster_centroid: [0.1, 0.2, 0.3],
  assembly_status: 'pending',
  publication_status: 'draft',
  review_status: 'pending',
  review_reasons: [],
  first_published: '2026-04-12T00:00:00Z',
}

const SAMPLE_ARTICLE_IDS = ['art-1', 'art-2', 'art-3']
const SAMPLE_OWNER = 'owner-abc-123'

beforeEach(() => {
  vi.clearAllMocks()
})

/* ------------------------------------------------------------------ */
/*  createStoryWithArticles                                            */
/* ------------------------------------------------------------------ */
describe('createStoryWithArticles', () => {
  it('returns created with storyId on success', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: 'story-uuid-123',
      error: null,
    })
    const client = makeClient(rpc)

    const result = await createStoryWithArticles(
      client,
      SAMPLE_STORY,
      SAMPLE_ARTICLE_IDS,
      SAMPLE_OWNER
    )

    expect(result).toEqual({ kind: 'created', storyId: 'story-uuid-123' })
    expect(rpc).toHaveBeenCalledWith('create_story_with_articles', {
      p_story: SAMPLE_STORY,
      p_article_ids: SAMPLE_ARTICLE_IDS,
      p_owner: SAMPLE_OWNER,
    })
  })

  it('returns error when articleIds is empty', async () => {
    const rpc = vi.fn()
    const client = makeClient(rpc)

    const result = await createStoryWithArticles(
      client,
      SAMPLE_STORY,
      [],
      SAMPLE_OWNER
    )

    expect(result).toEqual({
      kind: 'error',
      message: 'createStoryWithArticles requires at least one article id',
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns error when owner is null', async () => {
    const rpc = vi.fn()
    const client = makeClient(rpc)

    const result = await createStoryWithArticles(
      client,
      SAMPLE_STORY,
      SAMPLE_ARTICLE_IDS,
      null as never
    )

    expect(result).toEqual({
      kind: 'error',
      message: 'createStoryWithArticles requires a non-empty owner UUID',
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns error when owner is empty string', async () => {
    const rpc = vi.fn()
    const client = makeClient(rpc)

    const result = await createStoryWithArticles(
      client,
      SAMPLE_STORY,
      SAMPLE_ARTICLE_IDS,
      '' as never
    )

    expect(result).toEqual({
      kind: 'error',
      message: 'createStoryWithArticles requires a non-empty owner UUID',
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns error when owner is a non-string type', async () => {
    const rpc = vi.fn()
    const client = makeClient(rpc)

    const result = await createStoryWithArticles(
      client,
      SAMPLE_STORY,
      SAMPLE_ARTICLE_IDS,
      42 as never
    )

    expect(result).toEqual({
      kind: 'error',
      message: 'createStoryWithArticles requires a non-empty owner UUID',
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns ownership_moved when RPC error code is P0010', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0010', message: 'articles reassigned to newer owner' },
    })
    const client = makeClient(rpc)

    const result = await createStoryWithArticles(
      client,
      SAMPLE_STORY,
      SAMPLE_ARTICLE_IDS,
      SAMPLE_OWNER
    )

    expect(result).toEqual({
      kind: 'ownership_moved',
      detail: 'articles reassigned to newer owner',
    })
  })

  it('returns error on generic RPC error (non-P0010)', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })
    const client = makeClient(rpc)

    const result = await createStoryWithArticles(
      client,
      SAMPLE_STORY,
      SAMPLE_ARTICLE_IDS,
      SAMPLE_OWNER
    )

    expect(result).toEqual({
      kind: 'error',
      message: 'create_story_with_articles RPC failed: permission denied',
    })
  })

  it('returns error on P0001 validation error (not mapped to ownership_moved)', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'p_article_ids must not be empty' },
    })
    const client = makeClient(rpc)

    const result = await createStoryWithArticles(
      client,
      SAMPLE_STORY,
      SAMPLE_ARTICLE_IDS,
      SAMPLE_OWNER
    )

    expect(result).toEqual({
      kind: 'error',
      message: 'create_story_with_articles RPC failed: p_article_ids must not be empty',
    })
  })

  it('returns error when data is null', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const client = makeClient(rpc)

    const result = await createStoryWithArticles(
      client,
      SAMPLE_STORY,
      SAMPLE_ARTICLE_IDS,
      SAMPLE_OWNER
    )

    expect(result).toEqual({
      kind: 'error',
      message: 'create_story_with_articles returned unexpected shape',
    })
  })

  it('returns error when data is a number instead of string', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 42, error: null })
    const client = makeClient(rpc)

    const result = await createStoryWithArticles(
      client,
      SAMPLE_STORY,
      SAMPLE_ARTICLE_IDS,
      SAMPLE_OWNER
    )

    expect(result).toEqual({
      kind: 'error',
      message: 'create_story_with_articles returned unexpected shape',
    })
  })
})

/* ------------------------------------------------------------------ */
/*  mergeStories                                                       */
/* ------------------------------------------------------------------ */
describe('mergeStories', () => {
  it('returns true when RPC data is true', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    const client = makeClient(rpc)

    const result = await mergeStories(client, 'target-1', 'source-1', [0.5, 0.6])

    expect(result).toBe(true)
    expect(rpc).toHaveBeenCalledWith('merge_stories', {
      p_target: 'target-1',
      p_source: 'source-1',
      p_new_centroid: [0.5, 0.6],
    })
  })

  it('returns false when RPC data is not true', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null })
    const client = makeClient(rpc)

    const result = await mergeStories(client, 'target-1', 'source-1', [0.5])

    expect(result).toBe(false)
  })

  it('throws on RPC error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'foreign key violation' },
    })
    const client = makeClient(rpc)

    await expect(
      mergeStories(client, 'target-1', 'source-1', [0.5])
    ).rejects.toThrow('merge_stories failed: foreign key violation')
  })
})

/* ------------------------------------------------------------------ */
/*  deleteEmptyStory                                                   */
/* ------------------------------------------------------------------ */
describe('deleteEmptyStory', () => {
  it('returns true when RPC data is true', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    const client = makeClient(rpc)

    const result = await deleteEmptyStory(client, 'story-orphan')

    expect(result).toBe(true)
    expect(rpc).toHaveBeenCalledWith('delete_empty_story', {
      p_story_id: 'story-orphan',
    })
  })

  it('returns false when story still has articles', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null })
    const client = makeClient(rpc)

    const result = await deleteEmptyStory(client, 'story-notempty')

    expect(result).toBe(false)
  })

  it('throws on RPC error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'story not found' },
    })
    const client = makeClient(rpc)

    await expect(deleteEmptyStory(client, 'story-gone')).rejects.toThrow(
      'delete_empty_story failed: story not found'
    )
  })
})
