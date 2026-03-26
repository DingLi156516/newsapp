/**
 * lib/ai/tag-upsert.ts — Upsert extracted entities into tags + story_tags.
 *
 * Slugifies labels, deduplicates by slug, upserts tag rows, then
 * replaces story_tags for the given story. All errors are logged
 * and swallowed — tag failures must never block story publication.
 */

import anyAscii from 'any-ascii'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { ExtractedEntity } from '@/lib/ai/entity-extractor'

export function slugify(label: string): string {
  const raw = anyAscii(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return raw.slice(0, 100).replace(/-+$/, '')
}

interface DeduplicatedEntity {
  readonly slug: string
  readonly label: string
  readonly type: ExtractedEntity['type']
  readonly relevance: number
}

function deduplicateEntities(entities: readonly ExtractedEntity[]): readonly DeduplicatedEntity[] {
  const bySlug = new Map<string, DeduplicatedEntity>()

  for (const entity of entities) {
    const slug = slugify(entity.label)
    if (!slug) continue

    const key = `${slug}:${entity.type}`
    const existing = bySlug.get(key)
    if (!existing || entity.relevance > existing.relevance) {
      bySlug.set(key, {
        slug,
        label: entity.label,
        type: entity.type,
        relevance: entity.relevance,
      })
    }
  }

  return [...bySlug.values()]
}

async function clearStoryTags(
  client: SupabaseClient<Database>,
  storyId: string
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from('story_tags') as any)
      .delete()
      .eq('story_id', storyId)
    if (error) {
      console.error('[tag-upsert] Failed to clear stale story_tags:', error.message)
    }
  } catch (err) {
    console.error('[tag-upsert] Unexpected error clearing story_tags:', err instanceof Error ? err.message : String(err))
  }
}

export async function upsertStoryTags(
  client: SupabaseClient<Database>,
  storyId: string,
  entities: readonly ExtractedEntity[] | null
): Promise<void> {
  if (entities === null) return

  if (entities.length === 0) {
    await clearStoryTags(client, storyId)
    return
  }

  try {
    const deduplicated = deduplicateEntities(entities)
    if (deduplicated.length === 0) {
      await clearStoryTags(client, storyId)
      return
    }

    // Upsert tags (ON CONFLICT slug → do nothing)
    const tagRows = deduplicated.map((e) => ({
      slug: e.slug,
      label: e.label,
      tag_type: e.type,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertError } = await (client.from('tags') as any)
      .upsert(tagRows, { onConflict: 'slug,tag_type', ignoreDuplicates: true })

    if (upsertError) {
      console.error('[tag-upsert] Failed to upsert tags:', upsertError.message)
      return
    }

    // Fetch tag IDs by slug
    const slugs = deduplicated.map((e) => e.slug)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tagData, error: fetchError } = await (client.from('tags') as any)
      .select('id, slug, tag_type')
      .in('slug', slugs)

    if (fetchError || !tagData) {
      console.error('[tag-upsert] Failed to fetch tag IDs:', fetchError?.message)
      return
    }

    const slugToId = new Map<string, string>(
      (tagData as Array<{ id: string; slug: string; tag_type: string }>).map((t) => [`${t.slug}:${t.tag_type}`, t.id])
    )

    // Build story_tags rows
    const storyTagRows = deduplicated
      .map((e) => {
        const tagId = slugToId.get(`${e.slug}:${e.type}`)
        if (!tagId) return null
        return {
          story_id: storyId,
          tag_id: tagId,
          relevance: e.relevance,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)

    if (storyTagRows.length === 0) return

    // Upsert story_tags first (safe: existing rows preserved on failure)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertStoryTagsError } = await (client.from('story_tags') as any)
      .upsert(storyTagRows, { onConflict: 'story_id,tag_id' })

    if (upsertStoryTagsError) {
      console.error('[tag-upsert] Failed to upsert story_tags:', upsertStoryTagsError.message)
      return
    }

    // Delete stale story_tags that are no longer in the new set
    const newTagIds = storyTagRows.map((r) => r.tag_id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (client.from('story_tags') as any)
      .delete()
      .eq('story_id', storyId)
      .not('tag_id', 'in', `(${newTagIds.map((id) => `"${id}"`).join(',')})`)

    if (deleteError) {
      console.error('[tag-upsert] Failed to delete stale story_tags:', deleteError.message)
    }
  } catch (err) {
    console.error('[tag-upsert] Unexpected error:', err instanceof Error ? err.message : String(err))
  }
}
