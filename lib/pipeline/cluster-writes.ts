/**
 * lib/pipeline/cluster-writes.ts — Transactional cluster write helpers.
 *
 * Wraps the SECURITY DEFINER RPCs from migration 039
 * (`create_story_with_articles`, `merge_stories`, `delete_empty_story`)
 * so clustering and recluster callers don't have to assemble story
 * rows + article updates + rollback paths by hand.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export interface StoryCreatePayload {
  readonly headline?: string
  readonly story_kind?: string
  readonly topic?: string
  readonly source_count?: number
  readonly image_url?: string | null
  readonly cluster_centroid: readonly number[]
  readonly assembly_status?: string
  readonly publication_status?: string
  readonly review_status?: string
  readonly review_reasons?: readonly string[]
  readonly first_published: string
}

/**
 * Atomically create a new story row and assign its member articles.
 * Returns the new story id. Throws if either step fails — the entire
 * operation is rolled back by the RPC.
 */
export async function createStoryWithArticles(
  client: SupabaseClient<Database>,
  story: StoryCreatePayload,
  articleIds: readonly string[]
): Promise<string> {
  if (articleIds.length === 0) {
    throw new Error('createStoryWithArticles requires at least one article id')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc('create_story_with_articles', {
    p_story: story,
    p_article_ids: articleIds,
  })

  if (error) {
    throw new Error(`create_story_with_articles failed: ${error.message}`)
  }

  if (!data || typeof data !== 'string') {
    throw new Error('create_story_with_articles returned no story id')
  }

  return data
}

/**
 * Atomically merge `source` into `target`: reassign articles, update
 * target centroid, delete source. If any step fails the RPC rolls back
 * the entire transaction.
 */
export async function mergeStories(
  client: SupabaseClient<Database>,
  targetId: string,
  sourceId: string,
  newCentroid: readonly number[]
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc('merge_stories', {
    p_target: targetId,
    p_source: sourceId,
    p_new_centroid: newCentroid,
  })

  if (error) {
    throw new Error(`merge_stories failed: ${error.message}`)
  }

  return data === true
}

/**
 * Delete a story row if and only if it has no attached articles.
 * Safe to call for compensating cleanup after a failed multi-step write.
 */
export async function deleteEmptyStory(
  client: SupabaseClient<Database>,
  storyId: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc('delete_empty_story', {
    p_story_id: storyId,
  })

  if (error) {
    throw new Error(`delete_empty_story failed: ${error.message}`)
  }

  return data === true
}
