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

/**
 * Outcome of an owner-scoped stage-state write. See Phase 7b template at
 * lib/ai/clustering.ts:1366 for the original inlined version; this helper
 * extracts the same shape so every Phase 10 call site uses one pattern.
 */
export type OwnershipMoveOutcome =
  | { kind: 'applied' }           // update matched one row — claim is ours, write landed
  | { kind: 'ownership_moved' }   // row exists but claim belongs to another owner — benign, skip follow-up
  | { kind: 'row_missing' }       // row deleted — benign, skip follow-up
  | { kind: 'policy_drift'; detail: string }  // claim still ours but zero-match — LOUD failure
  | { kind: 'error'; message: string }        // update itself failed

interface OwnerScopedUpdateArgs {
  readonly table: 'articles' | 'stories'
  readonly id: string
  readonly owner: ClaimOwner
  readonly ownerColumn:
    | 'clustering_claim_owner'
    | 'embedding_claim_owner'
    | 'assembly_claim_owner'
  readonly payload: Record<string, unknown>
}

/**
 * Apply an owner-scoped stage-state update and verify exactly one of:
 *  - the write landed (applied)
 *  - the row moved to another claim (ownership_moved — benign)
 *  - the row was deleted (row_missing — benign)
 *  - the claim is still ours but the write matched zero rows (policy_drift — LOUD)
 *
 * Pipeline stages run under the Supabase service role, so the verify
 * read below cannot be filtered by RLS — `data: null` unambiguously
 * means the row does not exist.
 */
export async function runOwnerScopedUpdate(
  client: SupabaseClient<Database>,
  args: OwnerScopedUpdateArgs
): Promise<OwnershipMoveOutcome> {
  let error: { message: string } | null = null
  let count: number | null | undefined = undefined
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (client.from(args.table) as any)
      .update(args.payload, { count: 'exact' })
      .eq('id', args.id)
      .eq(args.ownerColumn, args.owner)
    error = res.error
    count = res.count
  } catch (thrown) {
    return {
      kind: 'error',
      message: thrown instanceof Error ? thrown.message : String(thrown),
    }
  }

  if (error) {
    return { kind: 'error', message: error.message }
  }

  if (typeof count === 'number' && count >= 1) {
    return { kind: 'applied' }
  }

  // count===0 (or count not returned): verify ownership before declaring success.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verifyQuery = (client.from(args.table) as any)
      .select(args.ownerColumn)
      .eq('id', args.id)
    const verify = typeof verifyQuery.maybeSingle === 'function'
      ? verifyQuery.maybeSingle()
      : typeof verifyQuery.single === 'function'
        ? verifyQuery.single()
        : verifyQuery
    const { data, error: verifyError } = await verify

    if (verifyError) {
      return {
        kind: 'policy_drift',
        detail: `zero-match update + verify read failed: ${verifyError.message}`,
      }
    }

    if (!data) {
      return { kind: 'row_missing' }
    }

    const currentOwner = (data as Record<string, string | null>)[args.ownerColumn]
    if (currentOwner === null || currentOwner !== args.owner) {
      return { kind: 'ownership_moved' }
    }

    return {
      kind: 'policy_drift',
      detail: 'zero-match update but claim still held by this owner',
    }
  } catch (verifyErr) {
    const message =
      verifyErr instanceof Error ? verifyErr.message : String(verifyErr)
    return {
      kind: 'policy_drift',
      detail: `verify read threw: ${message}`,
    }
  }
}
