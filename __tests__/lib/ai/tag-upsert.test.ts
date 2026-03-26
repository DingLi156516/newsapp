/**
 * Tests for lib/ai/tag-upsert.ts — slugify and upsertStoryTags.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { slugify, upsertStoryTags } from '@/lib/ai/tag-upsert'
import type { ExtractedEntity } from '@/lib/ai/entity-extractor'

describe('slugify', () => {
  it('converts label to lowercase slug', () => {
    expect(slugify('Iran War')).toBe('iran-war')
  })

  it('converts spaces and special chars to hyphens', () => {
    expect(slugify('Donald Trump')).toBe('donald-trump')
  })

  it('strips accents', () => {
    expect(slugify('Francois Hollande')).toBe('francois-hollande')
  })

  it('handles accented Latin characters', () => {
    expect(slugify('François Hollande')).toBe('francois-hollande')
  })

  it('transliterates Chinese characters', () => {
    const result = slugify('习近平')
    expect(result).not.toBe('')
    expect(result).toMatch(/^[a-z0-9-]+$/)
  })

  it('transliterates Cyrillic characters', () => {
    expect(slugify('Путин')).toBe('putin')
  })

  it('handles mixed scripts', () => {
    const result = slugify('习近平 Xi Jinping')
    expect(result).toMatch(/^[a-z0-9-]+$/)
    expect(result).toContain('xi-jinping')
  })

  it('removes leading/trailing hyphens', () => {
    expect(slugify('--test--')).toBe('test')
  })

  it('collapses multiple hyphens', () => {
    expect(slugify('a   b   c')).toBe('a-b-c')
  })

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })

  it('truncates slug to 100 characters', () => {
    const longLabel = 'a'.repeat(200)
    const result = slugify(longLabel)
    expect(result.length).toBeLessThanOrEqual(100)
    expect(result).toBe('a'.repeat(100))
  })

  it('strips trailing hyphen after truncation', () => {
    // Create a label that will produce a slug with a hyphen right at the 100-char boundary
    const label = 'a'.repeat(99) + ' ' + 'b'.repeat(50)
    const result = slugify(label)
    expect(result.length).toBeLessThanOrEqual(100)
    expect(result).not.toMatch(/-$/)
  })
})

describe('upsertStoryTags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockClient(overrides: {
    upsertError?: { message: string } | null
    fetchData?: Array<{ id: string; slug: string; tag_type: string }> | null
    fetchError?: { message: string } | null
    storyTagUpsertError?: { message: string } | null
    deleteError?: { message: string } | null
  } = {}) {
    const upsertFn = vi.fn().mockResolvedValue({
      error: overrides.upsertError ?? null,
    })
    const selectFn = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: overrides.fetchData ?? [{ id: 'tag-1', slug: 'iran', tag_type: 'location' }],
        error: overrides.fetchError ?? null,
      }),
    })
    const storyTagUpsertFn = vi.fn().mockResolvedValue({
      error: overrides.storyTagUpsertError ?? null,
    })
    const deleteNotFn = vi.fn().mockResolvedValue({ error: overrides.deleteError ?? null })
    const deleteEqFn = vi.fn().mockReturnValue({ not: deleteNotFn })
    const deleteFn = vi.fn().mockReturnValue({ eq: deleteEqFn })

    const fromFn = vi.fn().mockImplementation((table: string) => {
      if (table === 'tags') {
        return {
          upsert: upsertFn,
          select: selectFn,
        }
      }
      if (table === 'story_tags') {
        return {
          upsert: storyTagUpsertFn,
          delete: deleteFn,
        }
      }
      return {}
    })

    return { from: fromFn, _upsertFn: upsertFn, _storyTagUpsertFn: storyTagUpsertFn, _deleteFn: deleteFn, _deleteNotFn: deleteNotFn }
  }

  const entities: readonly ExtractedEntity[] = [
    { label: 'Iran', type: 'location', relevance: 0.95 },
    { label: 'NATO', type: 'organization', relevance: 0.8 },
  ]

  it('preserves existing tags when entities is null (extraction failed)', async () => {
    const fromFn = vi.fn()
    const client = { from: fromFn }

    await upsertStoryTags(client as never, 'story-1', null)

    expect(fromFn).not.toHaveBeenCalled()
  })

  it('clears stale story_tags when entities is empty', async () => {
    const deleteEqFn = vi.fn().mockResolvedValue({ error: null })
    const deleteFn = vi.fn().mockReturnValue({ eq: deleteEqFn })
    const fromFn = vi.fn().mockReturnValue({ delete: deleteFn })
    const client = { from: fromFn }

    await upsertStoryTags(client as never, 'story-1', [])

    expect(fromFn).toHaveBeenCalledWith('story_tags')
    expect(deleteFn).toHaveBeenCalled()
    expect(deleteEqFn).toHaveBeenCalledWith('story_id', 'story-1')
  })

  it('swallows errors when clearing stale story_tags for empty entities', async () => {
    const deleteEqFn = vi.fn().mockResolvedValue({ error: { message: 'DB error' } })
    const deleteFn = vi.fn().mockReturnValue({ eq: deleteEqFn })
    const fromFn = vi.fn().mockReturnValue({ delete: deleteFn })
    const client = { from: fromFn }

    await expect(
      upsertStoryTags(client as never, 'story-1', [])
    ).resolves.not.toThrow()
  })

  it('upserts tags, upserts story_tags, and deletes stale ones', async () => {
    const client = createMockClient({
      fetchData: [
        { id: 'tag-1', slug: 'iran', tag_type: 'location' },
        { id: 'tag-2', slug: 'nato', tag_type: 'organization' },
      ],
    })

    await upsertStoryTags(client as never, 'story-1', entities)

    expect(client._upsertFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'iran', label: 'Iran', tag_type: 'location' }),
        expect.objectContaining({ slug: 'nato', label: 'NATO', tag_type: 'organization' }),
      ]),
      { onConflict: 'slug,tag_type', ignoreDuplicates: true }
    )
    expect(client._storyTagUpsertFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ story_id: 'story-1', tag_id: 'tag-1', relevance: 0.95 }),
        expect.objectContaining({ story_id: 'story-1', tag_id: 'tag-2', relevance: 0.8 }),
      ]),
      { onConflict: 'story_id,tag_id' }
    )
    expect(client._deleteFn).toHaveBeenCalled()
    expect(client._deleteNotFn).toHaveBeenCalledWith(
      'tag_id', 'in', expect.stringMatching(/^\(".*",".*"\)$/)
    )
  })

  it('keeps old tags when story_tags upsert fails', async () => {
    const client = createMockClient({
      fetchData: [{ id: 'tag-1', slug: 'iran', tag_type: 'location' }],
      storyTagUpsertError: { message: 'DB error' },
    })

    await expect(
      upsertStoryTags(client as never, 'story-1', [
        { label: 'Iran', type: 'location', relevance: 0.9 },
      ])
    ).resolves.not.toThrow()

    // Delete should NOT be called when upsert fails — old tags preserved
    expect(client._deleteFn).not.toHaveBeenCalled()
  })

  it('deduplicates entities by slug, keeping highest relevance', async () => {
    const dupeEntities: readonly ExtractedEntity[] = [
      { label: 'Iran', type: 'location', relevance: 0.95 },
      { label: 'iran', type: 'location', relevance: 0.5 },
    ]

    const client = createMockClient({
      fetchData: [{ id: 'tag-1', slug: 'iran', tag_type: 'location' }],
    })

    await upsertStoryTags(client as never, 'story-1', dupeEntities)

    expect(client._upsertFn).toHaveBeenCalledWith(
      [expect.objectContaining({ slug: 'iran', label: 'Iran' })],
      expect.any(Object)
    )
  })

  it('swallows upsert errors', async () => {
    const client = createMockClient({
      upsertError: { message: 'DB error' },
    })

    await expect(
      upsertStoryTags(client as never, 'story-1', entities)
    ).resolves.not.toThrow()
  })

  it('swallows fetch errors', async () => {
    const client = createMockClient({
      fetchError: { message: 'DB error' },
    })

    await expect(
      upsertStoryTags(client as never, 'story-1', entities)
    ).resolves.not.toThrow()
  })

  it('clears stale story_tags when all entities slugify to empty', async () => {
    const deleteEqFn = vi.fn().mockResolvedValue({ error: null })
    const deleteFn = vi.fn().mockReturnValue({ eq: deleteEqFn })
    const fromFn = vi.fn().mockReturnValue({ delete: deleteFn })
    const client = { from: fromFn }

    // Entities with labels that produce empty slugs (punctuation-only)
    const emptySlugEntities: readonly ExtractedEntity[] = [
      { label: '!!!', type: 'person', relevance: 0.9 },
      { label: '???', type: 'location', relevance: 0.8 },
    ]

    await upsertStoryTags(client as never, 'story-1', emptySlugEntities)

    expect(fromFn).toHaveBeenCalledWith('story_tags')
    expect(deleteFn).toHaveBeenCalled()
    expect(deleteEqFn).toHaveBeenCalledWith('story_id', 'story-1')
  })

  it('allows same slug with different types (composite key)', async () => {
    const mixedEntities: readonly ExtractedEntity[] = [
      { label: 'Jordan', type: 'person', relevance: 0.9 },
      { label: 'Jordan', type: 'location', relevance: 0.85 },
    ]

    const client = createMockClient({
      fetchData: [
        { id: 'tag-1', slug: 'jordan', tag_type: 'person' },
        { id: 'tag-2', slug: 'jordan', tag_type: 'location' },
      ],
    })

    await upsertStoryTags(client as never, 'story-1', mixedEntities)

    // Both should survive deduplication and produce separate tag rows
    expect(client._upsertFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'jordan', tag_type: 'person' }),
        expect.objectContaining({ slug: 'jordan', tag_type: 'location' }),
      ]),
      { onConflict: 'slug,tag_type', ignoreDuplicates: true }
    )

    // Both should produce separate story_tag rows
    expect(client._storyTagUpsertFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ tag_id: 'tag-1', relevance: 0.9 }),
        expect.objectContaining({ tag_id: 'tag-2', relevance: 0.85 }),
      ]),
      { onConflict: 'story_id,tag_id' }
    )
  })

  it('swallows delete errors for stale tags', async () => {
    const client = createMockClient({
      fetchData: [{ id: 'tag-1', slug: 'iran', tag_type: 'location' }],
      deleteError: { message: 'DB error' },
    })

    await expect(
      upsertStoryTags(client as never, 'story-1', [
        { label: 'Iran', type: 'location', relevance: 0.9 },
      ])
    ).resolves.not.toThrow()
  })
})
