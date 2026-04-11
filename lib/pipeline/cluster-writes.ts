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
import type { ClaimOwner } from '@/lib/pipeline/claim-utils'

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
 * Outcome of a `create_story_with_articles` RPC call.
 *
 * `ownership_moved` is the benign case: migration 045 raises
 * SQLSTATE P0010 when the owner-scoped UPDATE inside the function
 * matches fewer rows than `p_article_ids` (i.e. a stale clustering
 * worker past its TTL whose articles now belong to a newer owner).
 * PostgREST forwards the SQLSTATE as `error.code`. Callers should
 * treat this as "skip retry, emit ownership_moved event" — not as
 * a retriable failure.
 *
 * The owner-mismatch path uses a dedicated SQLSTATE (P0010, in the
 * reserved P0XXX plpgsql custom-code range) specifically so that
 * the two validation guards in the migration — null/empty
 * `p_article_ids` and null `p_owner` — stay on the default P0001
 * and surface as loud caller bugs instead of being silently mapped
 * to the benign "ownership_moved" branch by this wrapper.
 */
export type CreateStoryOutcome =
  | { kind: 'created'; storyId: string }
  | { kind: 'ownership_moved'; detail: string }
  | { kind: 'error'; message: string }

/**
 * Atomically create a new story row and assign its member articles.
 * Returns a discriminated-union outcome so callers can distinguish
 * the benign "ownership_moved" (P0010) case from generic RPC failures
 * without string-matching the error message.
 */
export async function createStoryWithArticles(
  client: SupabaseClient<Database>,
  story: StoryCreatePayload,
  articleIds: readonly string[],
  owner: ClaimOwner
): Promise<CreateStoryOutcome> {
  if (articleIds.length === 0) {
    return {
      kind: 'error',
      message: 'createStoryWithArticles requires at least one article id',
    }
  }

  // Defense-in-depth: catch caller bugs (null/empty owner) BEFORE the
  // RPC, so they surface as a loud error rather than being silently
  // mapped to ownership_moved by the SQLSTATE handler below. Even
  // though migration 045 uses distinct SQLSTATEs for validation vs
  // owner-mismatch, a null owner hitting the RPC would raise P0001
  // from the validation guard — which we correctly treat as an
  // error, not ownership_moved — but short-circuiting here keeps the
  // error message actionable and avoids a pointless network round-trip.
  if (!owner || typeof owner !== 'string') {
    return {
      kind: 'error',
      message: 'createStoryWithArticles requires a non-empty owner UUID',
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc('create_story_with_articles', {
    p_story: story,
    p_article_ids: articleIds,
    p_owner: owner,
  })

  if (error) {
    // Migration 045 uses ERRCODE=P0010 specifically for the owner-
    // mismatch path so callers can treat it as benign without
    // collision with plain P0001 validation errors (null owner,
    // empty article list). Any other code — including P0001 —
    // drops through to the generic error branch.
    if ((error as { code?: string }).code === 'P0010') {
      return { kind: 'ownership_moved', detail: error.message }
    }
    return {
      kind: 'error',
      message: `create_story_with_articles RPC failed: ${error.message}`,
    }
  }

  if (!data || typeof data !== 'string') {
    return {
      kind: 'error',
      message: 'create_story_with_articles returned unexpected shape',
    }
  }

  return { kind: 'created', storyId: data }
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
