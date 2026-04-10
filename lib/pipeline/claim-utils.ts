/**
 * lib/pipeline/claim-utils.ts — Atomic claim-lease helpers.
 *
 * Claims for the embed / cluster / assemble stages are issued by
 * SECURITY DEFINER RPCs defined in migration 037. Each pipeline run
 * generates one owner UUID; releases are owner-scoped so a stale worker
 * cannot clear a newer worker's claim.
 *
 * See `supabase/migrations/037_atomic_claim_leases.sql`.
 */

import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const MINUTE_MS = 60 * 1000

export const ARTICLE_STAGE_CLAIM_TTL_MS = 30 * MINUTE_MS
export const ASSEMBLY_CLAIM_TTL_MS = 60 * MINUTE_MS

const ARTICLE_STAGE_CLAIM_TTL_SECONDS = Math.floor(ARTICLE_STAGE_CLAIM_TTL_MS / 1000)
const ASSEMBLY_CLAIM_TTL_SECONDS = Math.floor(ASSEMBLY_CLAIM_TTL_MS / 1000)

/** UUID that identifies the current pipeline run's ownership of claims. */
export type ClaimOwner = string

/** Generate a new owner UUID for a pipeline run. */
export function generateClaimOwner(): ClaimOwner {
  return randomUUID()
}

function unwrapIds(data: unknown): string[] {
  if (!data) return []
  if (Array.isArray(data)) {
    return data
      .map((row) => {
        if (typeof row === 'string') return row
        if (row && typeof row === 'object' && 'id' in row) {
          return (row as { id: string }).id
        }
        return null
      })
      .filter((id): id is string => typeof id === 'string')
  }
  return []
}

/**
 * Atomically claim up to `limit` un-embedded articles for the given owner.
 * Returns the article IDs that were successfully claimed.
 */
export async function claimEmbeddingBatch(
  client: SupabaseClient<Database>,
  owner: ClaimOwner,
  limit: number
): Promise<string[]> {
  if (limit <= 0) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc('claim_articles_for_embedding', {
    p_owner: owner,
    p_limit: limit,
    p_ttl_seconds: ARTICLE_STAGE_CLAIM_TTL_SECONDS,
  })

  if (error) {
    throw new Error(`Failed to claim embedding batch: ${error.message}`)
  }

  return unwrapIds(data)
}

/**
 * Atomically claim up to `limit` unclustered articles for the given owner.
 */
export async function claimClusteringBatch(
  client: SupabaseClient<Database>,
  owner: ClaimOwner,
  limit: number
): Promise<string[]> {
  if (limit <= 0) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc('claim_articles_for_clustering', {
    p_owner: owner,
    p_limit: limit,
    p_ttl_seconds: ARTICLE_STAGE_CLAIM_TTL_SECONDS,
  })

  if (error) {
    throw new Error(`Failed to claim clustering batch: ${error.message}`)
  }

  return unwrapIds(data)
}

/**
 * Atomically claim up to `limit` pending stories for assembly.
 * On success the rows' assembly_status is set to 'processing'.
 */
export async function claimAssemblyBatch(
  client: SupabaseClient<Database>,
  owner: ClaimOwner,
  limit: number
): Promise<string[]> {
  if (limit <= 0) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc('claim_stories_for_assembly', {
    p_owner: owner,
    p_limit: limit,
    p_ttl_seconds: ASSEMBLY_CLAIM_TTL_SECONDS,
  })

  if (error) {
    throw new Error(`Failed to claim assembly batch: ${error.message}`)
  }

  return unwrapIds(data)
}

/** Release an embedding claim iff the caller still owns it. */
export async function releaseEmbeddingClaim(
  client: SupabaseClient<Database>,
  articleId: string,
  owner: ClaimOwner
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any).rpc('release_embedding_claim', {
    p_article_id: articleId,
    p_owner: owner,
  })
}

/** Release many embedding claims in parallel. */
export async function releaseEmbeddingClaims(
  client: SupabaseClient<Database>,
  articleIds: readonly string[],
  owner: ClaimOwner
): Promise<void> {
  if (articleIds.length === 0) return
  await Promise.all(
    articleIds.map((id) => releaseEmbeddingClaim(client, id, owner))
  )
}

/**
 * Release a clustering claim iff the caller still owns it.
 *
 * Throws on RPC error so callers can surface deploy-skew problems
 * (e.g., migration 037 missing) instead of silently stranding claims.
 */
export async function releaseClusteringClaim(
  client: SupabaseClient<Database>,
  articleId: string,
  owner: ClaimOwner
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client as any).rpc('release_clustering_claim', {
    p_article_id: articleId,
    p_owner: owner,
  })
  if (error) {
    throw new Error(
      `release_clustering_claim RPC failed for ${articleId}: ${error.message}`
    )
  }
}

/**
 * Release many clustering claims, returning a list of IDs that could
 * not be released. Does NOT throw — callers decide how to surface the
 * partial failure (usually via the stage's `errors` array).
 */
export async function releaseClusteringClaims(
  client: SupabaseClient<Database>,
  articleIds: readonly string[],
  owner: ClaimOwner
): Promise<{ failed: Array<{ id: string; message: string }> }> {
  const failed: Array<{ id: string; message: string }> = []
  for (const id of articleIds) {
    try {
      await releaseClusteringClaim(client, id, owner)
    } catch (err) {
      failed.push({
        id,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return { failed }
}

/** Release an assembly claim iff the caller still owns it. */
export async function releaseAssemblyClaim(
  client: SupabaseClient<Database>,
  storyId: string,
  owner: ClaimOwner
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any).rpc('release_assembly_claim', {
    p_story_id: storyId,
    p_owner: owner,
  })
}
