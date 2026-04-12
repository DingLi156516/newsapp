/**
 * lib/ai/clustering.ts — Score-ranked article clustering.
 *
 * Groups articles by cosine similarity of their embeddings within a time
 * window. Refactored into composable stages:
 *
 * 1. fetchUnassignedArticles — query + filter articles from DB
 * 2. claimArticleBatch — bulk claim articles for processing
 * 3. matchAgainstExistingStories — Pass 1: match articles to story centroids
 * 4. clusterUnmatchedArticles — Pass 2: union-find clustering with centroid validation
 * 5. persistPass1Assignments — write Pass 1 results to DB
 * 6. persistNewClusters — create/merge stories from new clusters
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { FactualityLevel } from '@/lib/types'
import { combinedWeight } from '@/lib/ai/centroid-weights'
import {
  claimClusteringBatch,
  generateClaimOwner,
  releaseClusteringClaims,
  runOwnerScopedUpdate,
  type ClaimOwner,
} from '@/lib/pipeline/claim-utils'
import { fetchAssemblyVersions, requeueStoryForReassembly } from '@/lib/pipeline/reassembly'
import { createStoryWithArticles } from '@/lib/pipeline/cluster-writes'
import { computeRetryOutcome } from '@/lib/pipeline/retry-policy'
import {
  noopStageEmitter,
  safeEmit,
  type StageEventEmitter,
} from '@/lib/pipeline/stage-events'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SIMILARITY_THRESHOLD = Number(process.env.CLUSTERING_SIMILARITY_THRESHOLD ?? 0.70)
const SPLIT_THRESHOLD = Number(process.env.CLUSTERING_SPLIT_THRESHOLD ?? 0.60)
const PGVECTOR_CANDIDATE_COUNT = Number(process.env.CLUSTERING_CANDIDATE_COUNT ?? 15)
const STANDARD_MATCH_WINDOW_HOURS = 168
const MAX_CLUSTERING_ATTEMPTS = 3
const PGVECTOR_BATCH_SIZE = Number(process.env.CLUSTERING_PGVECTOR_BATCH_SIZE ?? 25)
// Cap the unmatched-set used for O(n²) union-find clustering. Beyond this
// point the quadratic cost dominates the batch budget, and the oldest
// unmatched articles are least likely to form new clusters anyway.
const UNMATCHED_CLUSTER_CAP = Number(process.env.CLUSTERING_UNMATCHED_CAP ?? 1000)

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EmbeddedArticleRow {
  id: string
  title: string
  source_id: string
  embedding: string | number[]
  published_at: string
  created_at: string
  story_id: string | null
  image_url: string | null
  clustering_attempts: number
  // Joined from sources(factuality). May be null if the source row is
  // missing or the source has no rating yet; weighted-centroid code
  // treats null as "use equal weight" per combinedWeight fallback logic.
  sources: { factuality: FactualityLevel | null } | null
}

interface EmbeddedArticle {
  id: string
  title: string
  source_id: string
  embedding: number[]
  published_at: string
  created_at: string
  story_id: string | null
  image_url: string | null
  clustering_attempts: number
  // Flattened from the sources(factuality) join in
  // `fetchClaimedClusterRows`. Optional so older test fixtures that
  // construct `EmbeddedArticle` literals without a sources join still
  // typecheck; production rows always populate this via the mapper.
  // A missing value here is equivalent to `null` for centroid weighting
  // (treated as "use equal weight").
  factuality?: FactualityLevel | null
}

interface StoryWithCentroidRow {
  id: string
  cluster_centroid: string | number[]
  last_updated: string
}

interface StoryWithCentroid {
  id: string
  cluster_centroid: number[]
  last_updated: string
}

interface StoryTracker {
  centroid: number[]
  articleIds: string[]
}

interface ClusterCandidate {
  articleIds: string[]
  embeddings: number[][]
  /**
   * Per-article weights aligned to `embeddings`. Present when the cluster
   * was built from articles carrying factuality + published_at metadata.
   * `undefined` means equal-weight (back-compat for callers without
   * metadata, e.g. tests and legacy code paths).
   */
  weights?: number[]
  imageUrl: string | null
}

export interface ClusterableArticle {
  readonly id: string
  readonly embedding: number[]
  readonly image_url: string | null
  /**
   * Optional source factuality. When present together with `published_at`,
   * `clusterUnmatchedArticles` computes per-article centroid weights so
   * high-factuality and recent articles pull the centroid more strongly.
   * Omitting these keeps the original equal-weight behavior.
   */
  readonly factuality?: FactualityLevel | null
  readonly published_at?: string
}

export interface ClusterResult {
  readonly newStories: number
  readonly updatedStories: number
  readonly assignedArticles: number
  readonly unmatchedSingletons: number
  readonly promotedSingletons: number
  readonly expiredArticles: number
  readonly errors: readonly string[]
  readonly dbTimeMs?: number
}

/* ------------------------------------------------------------------ */
/*  Pure functions                                                     */
/* ------------------------------------------------------------------ */

function parseVector(v: string | number[]): number[] {
  if (Array.isArray(v)) return v
  return JSON.parse(v) as number[]
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  return dot / denom
}

/**
 * Element-wise centroid of a set of vectors.
 *
 * When `weights` is omitted (or all weights are equal), every vector
 * contributes equally — matching the original equal-weight behavior so
 * existing callers are preserved unchanged.
 *
 * When `weights` is provided, the centroid becomes a weighted average:
 *   centroid[i] = Σ (w_k · v_k[i]) / Σ w_k
 *
 * Used by the clustering pipeline with weights = factuality × time-decay
 * so high-factuality and recent articles pull the centroid toward their
 * embedding more than low-factuality or stale ones. See
 * `lib/ai/centroid-weights.ts` for the weight formula and constants.
 *
 * Weights must be non-negative and the same length as `vectors`. If the
 * total weight sum is zero (e.g. caller passed all-zero weights for a
 * degenerate input), the function falls back to the equal-weight path so
 * it never divides by zero.
 */
function computeCentroid(
  vectors: readonly (readonly number[])[],
  weights?: readonly number[],
): number[] {
  if (vectors.length === 0) return []

  const dim = vectors[0].length
  const centroid = new Array<number>(dim).fill(0)

  if (weights === undefined) {
    for (const vec of vectors) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += vec[i]
      }
    }

    for (let i = 0; i < dim; i++) {
      centroid[i] /= vectors.length
    }

    return centroid
  }

  let totalWeight = 0
  for (let k = 0; k < vectors.length; k++) {
    const w = weights[k] ?? 0
    totalWeight += w
    const vec = vectors[k]
    for (let i = 0; i < dim; i++) {
      centroid[i] += w * vec[i]
    }
  }

  if (totalWeight === 0) {
    // Degenerate weights (e.g. all zero) — fall back to equal weighting so
    // we never produce NaN. Callers should avoid this but defense-in-depth
    // matters for a pipeline helper.
    return computeCentroid(vectors)
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= totalWeight
  }

  return centroid
}

export function shouldStoryBeMatchable(
  lastUpdated: string,
  now = new Date()
): boolean {
  const ageMs = now.getTime() - new Date(lastUpdated).getTime()
  const windowMs = STANDARD_MATCH_WINDOW_HOURS * 60 * 60 * 1000
  return ageMs <= windowMs
}

function interleaveBySource(articles: EmbeddedArticle[]): EmbeddedArticle[] {
  const bySource = new Map<string, EmbeddedArticle[]>()
  for (const article of articles) {
    const existing = bySource.get(article.source_id) ?? []
    bySource.set(article.source_id, [...existing, article])
  }

  const queues = [...bySource.values()]
  const result: EmbeddedArticle[] = []
  let remaining = true

  while (remaining) {
    remaining = false
    for (const queue of queues) {
      if (queue.length > 0) {
        result.push(queue.shift()!)
        remaining = remaining || queue.length > 0
      }
    }
  }

  return result
}

/* ------------------------------------------------------------------ */
/*  DB helpers                                                         */
/* ------------------------------------------------------------------ */

/**
 * Handle per-article clustering failure with exponential backoff and DLQ
 * escalation when the retry budget is exhausted. Mirrors the embedding and
 * assembly failure handlers so every stage shares the same retry semantics.
 *
 * Delegates the actual state mutation to the `apply_clustering_failure`
 * SECURITY DEFINER RPC (migration 043) which performs the owner-scoped
 * UPDATE and (on exhaustion) the pipeline_dead_letter INSERT in a single
 * transaction. That atomicity is required — a prior two-write version of
 * this handler could leave an exhausted article in status='failed' +
 * next_attempt_at='2099-01-01' with no DLQ row if the worker crashed
 * between the UPDATE commit and the DLQ INSERT. Operators had no way to
 * recover such stranded rows.
 *
 * On each article:
 *   - clustering_retry_count += 1
 *   - clustering_next_attempt_at = now + backoff (gates the claim RPC)
 *   - clustering_last_error = error message
 *   - clustering_status → 'failed' when exhausted, 'pending' otherwise
 *   - claim cleared so another owner can pick it up after the backoff
 *   - DLQ entry inserted in the same transaction on exhaustion
 *
 * When the RPC returns false the UPDATE was a no-op (owner moved) —
 * the new owner is now responsible for retry and DLQ escalation.
 */
async function handleClusteringFailure(
  client: SupabaseClient<Database>,
  articleIds: readonly string[],
  errorMessage: string,
  owner: ClaimOwner,
  emitter: StageEventEmitter
): Promise<void> {
  if (articleIds.length === 0) return

  const FAR_FUTURE = '2099-01-01T00:00:00Z'

  // Read current retry counts so we can apply per-article backoff. The
  // RPC is owner-scoped, so a stale row we mis-read here just results
  // in a no-op RPC return.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = (client.from('articles') as any)
    .select('id, clustering_retry_count')
  const withFilter = typeof query.in === 'function'
    ? query.in('id', articleIds)
    : query
  const { data, error: readError } = await withFilter

  const retryCounts = new Map<string, number>()
  if (readError) {
    console.warn(
      `[clustering] failed to read retry counts: ${readError.message}`
    )
    await safeEmit(emitter, {
      stage: 'cluster',
      level: 'warn',
      eventType: 'retry_count_read_failed',
      payload: { error: readError.message, articleCount: articleIds.length },
    })
  } else {
    for (const row of (data as {
      id: string
      clustering_retry_count: number | null
    }[] | null) ?? []) {
      retryCounts.set(row.id, row.clustering_retry_count ?? 0)
    }
  }

  for (const articleId of articleIds) {
    const previous = retryCounts.get(articleId) ?? 0
    const outcome = computeRetryOutcome('cluster', previous)
    const nextAttemptAt = outcome.exhausted
      ? FAR_FUTURE
      : outcome.nextAttemptAt.toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: applied, error: rpcError } = await (client as any).rpc(
      'apply_clustering_failure',
      {
        p_article_id: articleId,
        p_owner: owner,
        p_retry_count: outcome.nextRetryCount,
        p_next_attempt_at: nextAttemptAt,
        p_last_error: errorMessage,
        p_exhausted: outcome.exhausted,
      }
    )

    if (rpcError) {
      // Fail loud. An RPC error here almost always means the
      // `apply_clustering_failure` function is missing (migration 043
      // not applied) or the service role cannot execute it. Either
      // way, silently continuing would drop the retry + DLQ state for
      // every failing article in this pipeline run — exactly the kind
      // of silent data loss this hardening series exists to prevent.
      //
      // Throwing here lets the error bubble up to the pipeline step's
      // error aggregator so operators see a loud failure in their
      // run logs and fix the deployment before the next pass.
      throw new Error(
        `apply_clustering_failure RPC failed for ${articleId}: ${rpcError.message}. ` +
          `If this message mentions "function does not exist" or "not found in schema cache", ` +
          `migration 043 (supabase/migrations/043_atomic_clustering_failure.sql) has not been ` +
          `applied to this environment.`
      )
    }

    // Phase 10 Codex Round 1 Fix 2: migration 043's apply_clustering_failure
    // RPC returns BOOLEAN — `false` means its owner-scoped UPDATE
    // matched zero rows because another worker has reclaimed the
    // article under us. In that case NO retry state was written and
    // NO DLQ row was inserted — the new owner is now responsible for
    // both. Emitting `dlq_pushed` here would be a lie (there is no
    // DLQ row), so we emit the canonical `ownership_moved` info event
    // instead and skip the rest of the per-article bookkeeping.
    if (applied === false) {
      await safeEmit(emitter, {
        stage: 'cluster',
        level: 'info',
        eventType: 'ownership_moved',
        itemId: articleId,
        payload: { phase: 'failure', previousOwner: owner },
      })
      continue
    }

    // RPC succeeded — if this article was exhausted, a DLQ row was
    // inserted inside the same transaction (see migration 043).
    if (outcome.exhausted) {
      await safeEmit(emitter, {
        stage: 'cluster',
        level: 'error',
        eventType: 'dlq_pushed',
        itemId: articleId,
        payload: {
          articleId,
          retryCount: outcome.nextRetryCount,
          error: errorMessage,
        },
      })
    }
  }
}

/**
 * Apply a bulk clustering-state update using owner-scoped per-row writes.
 *
 * Splits the result into three buckets so callers can route each bucket
 * correctly:
 *   - applied:        update landed, claim cleared, caller should count as done
 *   - ownershipMoved: owner predicate matched zero rows (benign; another
 *                     worker now owns the article — skip follow-up)
 *   - failed:         real error from the UPDATE itself — caller should
 *                     route through handleClusteringFailure
 *
 * `policy_drift` is treated as a LOUD failure: we collect every drift
 * detail and throw a single aggregated error at the very end so that
 * benign + applied branches on the rest of the batch still run. This
 * mirrors the Task 3 embeddings pattern: never abort early on drift
 * because that would strand all the still-pending rows.
 */
async function bulkUpdateArticles(
  client: SupabaseClient<Database>,
  articleIds: readonly string[],
  payload: Record<string, unknown>,
  owner: ClaimOwner,
  emitter: StageEventEmitter
): Promise<{
  applied: string[]
  ownershipMoved: string[]
  failed: Array<{ id: string; message: string }>
}> {
  if (articleIds.length === 0) {
    return { applied: [], ownershipMoved: [], failed: [] }
  }

  // Phase 1: owner-scoped updates in parallel.
  const results = await Promise.all(
    articleIds.map(async (id) => {
      const outcome = await runOwnerScopedUpdate(client, {
        table: 'articles',
        id,
        owner,
        ownerColumn: 'clustering_claim_owner',
        payload,
      })
      return { id, outcome }
    })
  )

  // Phase 2: triage outcomes; collect policy_drift errors for LOUD throw.
  const applied: string[] = []
  const ownershipMoved: string[] = []
  const failed: Array<{ id: string; message: string }> = []
  const driftErrors: string[] = []

  for (const { id, outcome } of results) {
    switch (outcome.kind) {
      case 'applied':
        applied.push(id)
        break
      case 'ownership_moved':
      case 'row_missing':
        ownershipMoved.push(id)
        await safeEmit(emitter, {
          stage: 'cluster',
          level: 'info',
          eventType: 'ownership_moved',
          itemId: id,
          payload: { phase: 'assignment', previousOwner: owner },
        })
        break
      case 'error':
        failed.push({ id, message: outcome.message })
        break
      case 'policy_drift':
        driftErrors.push(
          `[cluster/policy_drift] owner-scoped write stranded claim ${id}: ${outcome.detail}`
        )
        break
    }
  }

  if (driftErrors.length > 0) {
    throw new Error(driftErrors.join('; '))
  }

  return { applied, ownershipMoved, failed }
}

/**
 * Guarded batch reassembly. Reads each story's current assembly_version
 * then calls the `requeue_story_for_reassembly` RPC for each. Any story
 * that is currently being assembled (or whose version no longer matches)
 * will not be reset — we log a soft "guarded" entry and leave the
 * running assembler to finish.
 */
async function queueStoriesForReassembly(
  client: SupabaseClient<Database>,
  storyIds: readonly string[],
  errors: string[]
): Promise<void> {
  if (storyIds.length === 0) return

  let versions: Map<string, number>
  try {
    versions = await fetchAssemblyVersions(client, storyIds)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    errors.push(`Failed to read assembly versions before requeue: ${message}`)
    return
  }

  for (const storyId of storyIds) {
    const expectedVersion = versions.get(storyId)
    if (expectedVersion === undefined) {
      errors.push(`Cannot requeue story ${storyId}: missing assembly_version`)
      continue
    }

    try {
      const requeued = await requeueStoryForReassembly(client, storyId, expectedVersion)
      if (!requeued) {
        // Guarded: a concurrent assembler owns this story or another requeue
        // won the race. The assembler will see the new state on its next pass.
        errors.push(
          `Story ${storyId} requeue guarded: currently processing or version mismatch (expected ${expectedVersion})`
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Failed to queue story ${storyId} for reassembly: ${message}`)
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Stage 1+2: Atomically claim a clustering batch                     */
/* ------------------------------------------------------------------ */
//
// Replaces the previous SELECT → filter → UPDATE pattern. The claim RPC
// issues a DB-side compare-and-set with owner token (migration 037),
// guaranteeing that two overlapping runners cannot claim the same rows.
// After the RPC returns claimed IDs we fetch the full rows for processing.
//
// NOTE: this helper deliberately does NOT call handleClusteringFailure on
// its own errors. The caller (`clusterArticles`) registers every claimed
// ID into `unhandledArticleIds` *before* awaiting the fetch, so that if
// the fetch throws, the caller's outer try/finally still owns cleanup of
// those claims. Keeping the failure routing single-sourced in the outer
// function prevents a class of bugs where an early-phase throw aborts
// the function before the cleanup scope is established.

async function claimClusteringIds(
  client: SupabaseClient<Database>,
  owner: ClaimOwner,
  maxArticles: number
): Promise<{ claimedIds: string[]; dbTimeMs: number }> {
  const claimStartedAt = Date.now()
  const claimedIds = await claimClusteringBatch(client, owner, maxArticles)
  return { claimedIds, dbTimeMs: Date.now() - claimStartedAt }
}

async function fetchClaimedClusterRows(
  client: SupabaseClient<Database>,
  claimedIds: readonly string[]
): Promise<{ claimableArticles: EmbeddedArticle[]; dbTimeMs: number }> {
  const fetchStartedAt = Date.now()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = (client.from('articles') as any)
    // `sources(factuality)` is a PostgREST foreign-table embed on the
    // existing articles.source_id FK. The extra column is tiny and the
    // join is indexed, so cost is negligible for the 200-row batch we
    // pull each pass. Consumed by `clusterUnmatchedArticles` to weight
    // the centroid by source factuality × publication time.
    .select('id, title, source_id, embedding, published_at, created_at, story_id, image_url, clustering_attempts, sources(factuality)')

  const withFilter = typeof query.in === 'function' ? query.in('id', claimedIds) : query
  const { data: fetchedData, error: fetchError } = await withFilter
  const dbTimeMs = Date.now() - fetchStartedAt

  if (fetchError) {
    throw new Error(`Failed to fetch claimed clustering batch: ${fetchError.message}`)
  }

  const fetchedRows = (fetchedData as EmbeddedArticleRow[] | null) ?? []
  if (fetchedRows.length === 0) {
    return { claimableArticles: [], dbTimeMs }
  }

  const claimable = fetchedRows
    .filter((row: EmbeddedArticleRow) => row.embedding !== null)
    .map((row: EmbeddedArticleRow) => ({
      ...row,
      embedding: parseVector(row.embedding),
      // Flatten sources(factuality) into a top-level column so the
      // downstream ClusterableArticle shape resolves without extra
      // plumbing through `interleaveBySource`/`matchAgainstExistingStories`.
      factuality: row.sources?.factuality ?? null,
    }))

  // Round-robin interleave by source_id for downstream diversity.
  const claimableArticles = interleaveBySource(claimable)
  return { claimableArticles, dbTimeMs }
}

/* ------------------------------------------------------------------ */
/*  Stage 3: Pass 1 — Hybrid pgvector + JS story matching              */
/* ------------------------------------------------------------------ */

/**
 * Match a single article against DB stories via pgvector RPC.
 * Returns the best matching story ID and similarity, or null.
 */
async function matchArticleViaRpc(
  client: SupabaseClient<Database>,
  embedding: number[],
  threshold: number,
  cutoffIso: string
): Promise<{ storyId: string; similarity: number } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc('match_story_centroid', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: PGVECTOR_CANDIDATE_COUNT,
    cutoff_time: cutoffIso,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data || data.length === 0) return null

  const best = data[0] as { story_id: string; similarity: number }
  return { storyId: best.story_id, similarity: best.similarity }
}

/**
 * JS brute-force fallback: match an article against all stories in storyMap.
 */
function matchArticleViaJs(
  embedding: readonly number[],
  storyMap: Map<string, StoryTracker>,
  threshold: number
): { storyId: string; similarity: number } | null {
  let bestStoryId: string | null = null
  let bestSimilarity = 0

  for (const [storyId, storyData] of storyMap) {
    const sim = cosineSimilarity(embedding, storyData.centroid)
    if (sim > bestSimilarity && sim >= threshold) {
      bestSimilarity = sim
      bestStoryId = storyId
    }
  }

  return bestStoryId ? { storyId: bestStoryId, similarity: bestSimilarity } : null
}

/**
 * Pass 1: Match articles against existing story centroids.
 *
 * Uses pgvector RPC for HNSW-accelerated centroid search.
 * Falls back to JS brute-force against the in-memory storyMap if RPC fails.
 */
async function matchAgainstExistingStories(
  client: SupabaseClient<Database>,
  articles: readonly EmbeddedArticle[],
  storyMap: Map<string, StoryTracker>,
  threshold: number,
  cutoffIso: string,
  emitter: StageEventEmitter
): Promise<{ pass1Assignments: Map<string, string[]>; unmatchedArticles: EmbeddedArticle[] }> {
  const pass1Assignments = new Map<string, string[]>()
  const unmatchedArticles: EmbeddedArticle[] = []

  let useRpc = true
  // Dedupe the pgvector_fallback emission across the whole call. A
  // concurrent batch can have many articles all catch the same RPC
  // outage and each try to emit; we want exactly one warn event per
  // matchAgainstExistingStories invocation regardless of how many
  // articles tripped the fallback.
  let fallbackEmitted = false

  // Process articles in batches to limit concurrent RPC calls
  for (let batchStart = 0; batchStart < articles.length; batchStart += PGVECTOR_BATCH_SIZE) {
    const batch = articles.slice(batchStart, batchStart + PGVECTOR_BATCH_SIZE)

    const results = await Promise.all(
      batch.map(async (article) => {
        let dbMatch: { storyId: string; similarity: number } | null = null

        if (useRpc) {
          try {
            dbMatch = await matchArticleViaRpc(client, article.embedding, threshold, cutoffIso)
          } catch (rpcErr) {
            const rpcMessage = rpcErr instanceof Error ? rpcErr.message : String(rpcErr)
            console.warn('pgvector RPC unavailable, falling back to JS brute-force:', rpcMessage)
            useRpc = false
            if (!fallbackEmitted) {
              fallbackEmitted = true
              await safeEmit(emitter, {
                stage: 'cluster',
                level: 'warn',
                eventType: 'pgvector_fallback',
                payload: { error: rpcMessage },
              })
            }
            dbMatch = matchArticleViaJs(article.embedding, storyMap, threshold)
          }
        } else {
          dbMatch = matchArticleViaJs(article.embedding, storyMap, threshold)
        }

        return { article, bestMatch: dbMatch }
      })
    )

    for (const { article, bestMatch } of results) {
      if (bestMatch) {
        storyMap.get(bestMatch.storyId)?.articleIds.push(article.id)

        const existing = pass1Assignments.get(bestMatch.storyId)
        if (existing) {
          existing.push(article.id)
        } else {
          pass1Assignments.set(bestMatch.storyId, [article.id])
        }
      } else {
        unmatchedArticles.push(article)
      }
    }
  }

  return { pass1Assignments, unmatchedArticles }
}

/* ------------------------------------------------------------------ */
/*  Stage 4: Pass 2 — Union-find score-ranked clustering               */
/* ------------------------------------------------------------------ */

/**
 * Cluster unmatched articles using union-find with score-ranked merging.
 *
 * 1. Compute all pairwise similarities among articles
 * 2. Sort pairs by similarity descending
 * 3. Union-find: merge pairs from highest to lowest similarity
 * 4. Centroid validation: eject members below threshold (prevents chaining)
 * 5. Return ClusterCandidate[] — deterministic regardless of input order
 *
 * When at least one article in the input carries `factuality` metadata, the
 * validation centroid is weighted via `combinedWeight(factuality, published_at,
 * now)` so high-factuality and recent articles pull the centroid toward their
 * embedding. The resulting `ClusterCandidate.weights` is also populated so
 * downstream centroid recomputations (e.g. duplicate detection) can reuse the
 * same weighting. When no article carries factuality, behavior is identical
 * to the pre-weighted implementation: `weights` stays undefined and
 * `computeCentroid` takes the equal-weight path.
 */
function clusterUnmatchedArticles(
  articles: readonly ClusterableArticle[],
  threshold: number,
  now: Date = new Date()
): ClusterCandidate[] {
  // Cap the O(n²) window. Union-find is O(α(n)) but the pair-generation
  // step is strictly quadratic; above ~1000 items the time dominates a 60s
  // cron budget. The excess is returned as singleton clusters so those
  // articles still progress (and will be retried in a subsequent pass).
  const bounded = articles.length > UNMATCHED_CLUSTER_CAP
    ? articles.slice(0, UNMATCHED_CLUSTER_CAP)
    : articles
  const excess = articles.length > UNMATCHED_CLUSTER_CAP
    ? articles.slice(UNMATCHED_CLUSTER_CAP)
    : []

  // Weighted centroid mode is opt-in per batch: if at least one article
  // carries factuality metadata we compute weights for every article in
  // `bounded` and propagate them through the ClusterCandidate. Otherwise
  // we leave weights undefined so the equal-weight path runs unchanged.
  const hasFactualityMetadata = bounded.some((a) => a.factuality != null)
  const weightFor = (article: ClusterableArticle): number => {
    if (article.factuality == null) return 1
    const publishedAt = article.published_at
      ? new Date(article.published_at)
      : now
    return combinedWeight(article.factuality, publishedAt, now)
  }
  const perArticleWeights: number[] = hasFactualityMetadata
    ? bounded.map(weightFor)
    : []

  const n = bounded.length
  if (n === 0) {
    return excess.map((article) => ({
      articleIds: [article.id],
      embeddings: [article.embedding],
      imageUrl: article.image_url,
    }))
  }

  // --- 1. Compute all pairwise similarities above threshold ---
  const pairs: { i: number; j: number; sim: number }[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(bounded[i].embedding, bounded[j].embedding)
      if (sim >= threshold) {
        pairs.push({ i, j, sim })
      }
    }
  }

  // --- 2. Sort by similarity descending ---
  pairs.sort((a, b) => b.sim - a.sim)

  // --- 3. Union-find with path compression and union by rank ---
  const parent = Array.from({ length: n }, (_, i) => i)
  const ufRank = new Array<number>(n).fill(0)

  function find(x: number): number {
    // Iterative path compression — avoids stack overflow for large n
    let root = x
    while (parent[root] !== root) root = parent[root]
    while (parent[x] !== root) {
      const next = parent[x]
      parent[x] = root
      x = next
    }
    return root
  }

  function union(x: number, y: number): void {
    const px = find(x)
    const py = find(y)
    if (px === py) return
    if (ufRank[px] < ufRank[py]) parent[px] = py
    else if (ufRank[px] > ufRank[py]) parent[py] = px
    else { parent[py] = px; ufRank[px]++ }
  }

  for (const { i, j } of pairs) {
    union(i, j)
  }

  // --- 4. Collect clusters by root ---
  const clusterMap = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const root = find(i)
    const members = clusterMap.get(root)
    if (members) {
      members.push(i)
    } else {
      clusterMap.set(root, [i])
    }
  }

  // --- 5. Centroid validation — eject outliers ---
  const clusters: ClusterCandidate[] = []

  for (const members of clusterMap.values()) {
    if (members.length === 1) {
      const article = bounded[members[0]]
      clusters.push({
        articleIds: [article.id],
        embeddings: [article.embedding],
        imageUrl: article.image_url,
      })
      continue
    }

    const embeddings = members.map((i) => bounded[i].embedding)
    const memberWeights = hasFactualityMetadata
      ? members.map((i) => perArticleWeights[i])
      : undefined
    const centroid = computeCentroid(embeddings, memberWeights)

    const valid: number[] = []
    const ejected: number[] = []

    for (const idx of members) {
      const sim = cosineSimilarity(bounded[idx].embedding, centroid)
      if (sim >= threshold) {
        valid.push(idx)
      } else {
        ejected.push(idx)
      }
    }

    if (valid.length > 0) {
      clusters.push({
        articleIds: valid.map((i) => bounded[i].id),
        embeddings: valid.map((i) => bounded[i].embedding),
        weights: hasFactualityMetadata
          ? valid.map((i) => perArticleWeights[i])
          : undefined,
        imageUrl: valid.map((i) => bounded[i].image_url).find((u) => u !== null) ?? null,
      })
    }

    // Ejected articles become singletons
    for (const idx of ejected) {
      const article = bounded[idx]
      clusters.push({
        articleIds: [article.id],
        embeddings: [article.embedding],
        imageUrl: article.image_url,
      })
    }
  }

  // Any articles above the cap become singletons so they still progress
  // (they'll be claimed again on the next pass).
  for (const article of excess) {
    clusters.push({
      articleIds: [article.id],
      embeddings: [article.embedding],
      imageUrl: article.image_url,
    })
  }

  return clusters
}

/* ------------------------------------------------------------------ */
/*  Centroid recomputation helper                                      */
/* ------------------------------------------------------------------ */

export async function recomputeStoryCentroid(
  client: SupabaseClient<Database>,
  storyId: string,
  storyMap: Map<string, StoryTracker>,
  errors: string[]
): Promise<number> {
  const startedAt = Date.now()

  try {
    // Pull factuality + published_at alongside embedding so the
    // recomputed centroid is biased by the same factuality × time-decay
    // weight formula used by the pass-2 validation centroid. Rows where
    // factuality is missing (join miss, legacy data) fall back to
    // equal-weight via `combinedWeight(..., publishedAt, now)` with the
    // mixed default — see the helper in centroid-weights.ts.
    const { data: allArticles, error: selectError } = await client
      .from('articles')
      .select('embedding, published_at, sources(factuality)')
      .eq('story_id', storyId)
      .not('embedding', 'is', null)
      .returns<
        {
          embedding: string | number[]
          published_at: string | null
          sources: { factuality: FactualityLevel | null } | null
        }[]
      >()

    if (selectError) {
      errors.push(
        `Failed to fetch embeddings for centroid recomputation of story ${storyId}: ${selectError.message}`
      )
      return Date.now() - startedAt
    }

    if (!allArticles || allArticles.length <= 1) {
      return Date.now() - startedAt
    }

    const now = new Date()
    const hasAnyFactuality = allArticles.some((a) => a.sources?.factuality != null)
    const embeddings = allArticles.map((a) => parseVector(a.embedding))
    const weights = hasAnyFactuality
      ? allArticles.map((a) => {
          const factuality = a.sources?.factuality
          if (factuality == null) return 1
          const publishedAt = a.published_at ? new Date(a.published_at) : now
          return combinedWeight(factuality, publishedAt, now)
        })
      : undefined
    const newCentroid = computeCentroid(embeddings, weights)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError, count } = await (client.from('stories') as any)
      .update({ cluster_centroid: newCentroid }, { count: 'exact' })
      .eq('id', storyId)

    if (updateError) {
      errors.push(
        `Failed to update centroid for story ${storyId}: ${updateError.message}`
      )
      return Date.now() - startedAt
    }

    if (count === 0) {
      errors.push(
        `Centroid update for story ${storyId} matched zero rows — story may have been deleted`
      )
      return Date.now() - startedAt
    }

    const story = storyMap.get(storyId)
    if (story) {
      storyMap.set(storyId, { ...story, centroid: newCentroid })
    }
  } catch (err) {
    errors.push(
      `Centroid recomputation failed for story ${storyId}: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  return Date.now() - startedAt
}

/* ------------------------------------------------------------------ */
/*  Stage 5: Persist Pass 1 assignments                                */
/* ------------------------------------------------------------------ */

async function persistPass1Assignments(
  client: SupabaseClient<Database>,
  pass1Assignments: Map<string, string[]>,
  storyMap: Map<string, StoryTracker>,
  unhandledArticleIds: Set<string>,
  storiesNeedingReassembly: Set<string>,
  errors: string[],
  owner: ClaimOwner,
  emitter: StageEventEmitter
): Promise<{ assignedArticles: number; dbTimeMs: number }> {
  let assignedArticles = 0
  let dbTimeMs = 0

  for (const [storyId, articleIds] of pass1Assignments) {
    const batchStartedAt = Date.now()
    const { applied, ownershipMoved, failed } = await bulkUpdateArticles(
      client,
      articleIds,
      {
        story_id: storyId,
        clustering_claimed_at: null,
        clustering_claim_owner: null,
        clustering_status: 'clustered',
      },
      owner,
      emitter
    )
    dbTimeMs += Date.now() - batchStartedAt

    // Applied: count as assigned and drop from unhandled.
    assignedArticles += applied.length
    for (const id of applied) {
      unhandledArticleIds.delete(id)
    }

    // Ownership moved / row missing: benign. Another owner will drive
    // the article. We drop from unhandled so the cleanup phase doesn't
    // burn retry budget on claims we no longer own.
    for (const id of ownershipMoved) {
      unhandledArticleIds.delete(id)
    }

    // Real failures: surface via errors[] and route through the
    // atomic failure RPC. Per-article handleClusteringFailure
    // preserves per-article DLQ diagnostics — with the fan-out in
    // bulkUpdateArticles each failure can carry a distinct message,
    // so collapsing them to `failed[0].message` would lose
    // granularity in the DLQ row.
    if (failed.length > 0) {
      for (const { id, message } of failed) {
        errors.push(`Failed to assign article ${id}: ${message}`)
        unhandledArticleIds.delete(id)
        await handleClusteringFailure(
          client,
          [id],
          `Failed to assign to story ${storyId}: ${message}`,
          owner,
          emitter
        )
      }
    }

    // Only queue reassembly + recompute if SOMETHING actually landed
    // in this story. An all-ownership_moved batch means nothing in
    // this worker's run actually touched the story membership.
    if (applied.length > 0) {
      storiesNeedingReassembly.add(storyId)
      dbTimeMs += await recomputeStoryCentroid(client, storyId, storyMap, errors)
    }
  }

  return { assignedArticles, dbTimeMs }
}

/* ------------------------------------------------------------------ */
/*  Stage 6: Persist new clusters                                      */
/* ------------------------------------------------------------------ */

async function persistNewClusters(
  client: SupabaseClient<Database>,
  newClusters: readonly ClusterCandidate[],
  claimableArticles: readonly EmbeddedArticle[],
  storyMap: Map<string, StoryTracker>,
  storiesNeedingReassembly: Set<string>,
  unhandledArticleIds: Set<string>,
  errors: string[],
  now: Date,
  owner: ClaimOwner,
  emitter: StageEventEmitter
): Promise<{
  newStories: number
  assignedArticles: number
  unmatchedSingletons: number
  promotedSingletons: number
  dbTimeMs: number
}> {
  let newStories = 0
  let assignedArticles = 0
  let unmatchedSingletons = 0
  let promotedSingletons = 0
  let dbTimeMs = 0

  for (const cluster of newClusters) {
    /* --- Singleton handling --- */
    if (cluster.articleIds.length < 2) {
      const article = claimableArticles.find((a) => a.id === cluster.articleIds[0])!
      const newAttempts = (article.clustering_attempts ?? 0) + 1

      if (newAttempts >= MAX_CLUSTERING_ATTEMPTS) {
        const centroid = cluster.embeddings[0]
        const createStartedAt = Date.now()
        const createOutcome = await createStoryWithArticles(
          client,
          {
            headline: 'Pending headline generation',
            story_kind: 'standard',
            topic: 'politics',
            source_count: 0,
            image_url: cluster.imageUrl,
            cluster_centroid: centroid,
            assembly_status: 'pending',
            publication_status: 'draft',
            review_status: 'pending',
            review_reasons: [],
            first_published: article.published_at,
          },
          [article.id],
          owner
        )
        dbTimeMs += Date.now() - createStartedAt

        if (createOutcome.kind === 'ownership_moved') {
          // Benign — the claim was reassigned between our fetch and
          // our promotion attempt. Another worker now owns the
          // article. Do not count as promoted, do not burn retry
          // budget, do not surface as an error.
          await safeEmit(emitter, {
            stage: 'cluster',
            level: 'info',
            eventType: 'ownership_moved',
            itemId: article.id,
            payload: {
              phase: 'singleton_promotion',
              previousOwner: owner,
              detail: createOutcome.detail,
            },
          })
          unhandledArticleIds.delete(article.id)
          continue
        }

        if (createOutcome.kind === 'error') {
          errors.push(
            `Failed to promote singleton ${article.id}: ${createOutcome.message}`
          )
          await handleClusteringFailure(
            client,
            [article.id],
            `Singleton promotion failed: ${createOutcome.message}`,
            owner,
            emitter
          )
          unhandledArticleIds.delete(article.id)
          continue
        }

        // createOutcome.kind === 'created'
        const newStoryId = createOutcome.storyId

        // Bookkeeping: bump clustering_attempts for the retry budget.
        // The claim is already cleared by create_story_with_articles,
        // so this write does NOT need owner-scoping — the article is
        // now assigned to the new story, clustering_claim_owner is
        // null, and no concurrent worker can race us on a non-claim
        // column.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client.from('articles') as any)
          .update({ clustering_attempts: newAttempts })
          .eq('id', article.id)

        promotedSingletons++
        assignedArticles++
        newStories++
        storyMap.set(newStoryId, { centroid, articleIds: [article.id] })
        unhandledArticleIds.delete(article.id)
      } else {
        // Singleton release: clear the claim and bump attempts so the
        // article can be retried on a later pass. Owner-scoped so a
        // stale worker cannot stomp a newer claim.
        const releaseOutcome = await runOwnerScopedUpdate(client, {
          table: 'articles',
          id: article.id,
          owner,
          ownerColumn: 'clustering_claim_owner',
          payload: {
            clustering_claimed_at: null,
            clustering_claim_owner: null,
            clustering_attempts: newAttempts,
          },
        })

        if (
          releaseOutcome.kind === 'ownership_moved' ||
          releaseOutcome.kind === 'row_missing'
        ) {
          // Benign — the claim moved (or the row was deleted). Do
          // not count as unmatched singleton: another worker now
          // owns the article and will drive it.
          await safeEmit(emitter, {
            stage: 'cluster',
            level: 'info',
            eventType: 'ownership_moved',
            itemId: article.id,
            payload: { phase: 'singleton_release', previousOwner: owner },
          })
          unhandledArticleIds.delete(article.id)
        } else if (releaseOutcome.kind === 'policy_drift') {
          // LOUD schema-level invariant violation: the claim is
          // still held by this owner but the UPDATE matched zero
          // rows. This prefix is reserved for drift so ops can
          // grep for it; do NOT tag plain DB errors with it.
          throw new Error(
            `[cluster/policy_drift] singleton release stranded claim ${article.id}: ${releaseOutcome.detail}`
          )
        } else if (releaseOutcome.kind === 'error') {
          // Plain DB error — route through the standard failure
          // handler (retry budget + potential DLQ). Do NOT count
          // as unmatchedSingletons; the outer `continue` below
          // skips the applied branch.
          errors.push(
            `Failed to release singleton claim ${article.id}: ${releaseOutcome.message}`
          )
          await handleClusteringFailure(
            client,
            [article.id],
            `Singleton release failed: ${releaseOutcome.message}`,
            owner,
            emitter
          )
          unhandledArticleIds.delete(article.id)
        } else {
          // applied — normal path.
          unmatchedSingletons++
          unhandledArticleIds.delete(article.id)
        }
      }
      continue
    }

    /* --- Multi-article cluster handling --- */
    // Reuse the weights attached by `clusterUnmatchedArticles` so the
    // duplicate-detection centroid is biased by the same factuality ×
    // time-decay formula as the validation centroid. When no weights
    // were attached (back-compat / metadata-less callers), this is the
    // equal-weight path.
    const centroid = computeCentroid(cluster.embeddings, cluster.weights)

    // Check for duplicate story in storyMap
    let duplicateStoryId: string | null = null
    let bestSimilarity = 0
    for (const [storyId, storyData] of storyMap) {
      const sim = cosineSimilarity(centroid, storyData.centroid)
      if (sim > bestSimilarity && sim >= SIMILARITY_THRESHOLD) {
        bestSimilarity = sim
        duplicateStoryId = storyId
      }
    }

    if (duplicateStoryId) {
      const dupAssignStartedAt = Date.now()
      const { applied, ownershipMoved, failed } = await bulkUpdateArticles(
        client,
        cluster.articleIds,
        {
          story_id: duplicateStoryId,
          clustering_claimed_at: null,
          clustering_claim_owner: null,
          clustering_status: 'clustered',
        },
        owner,
        emitter
      )
      dbTimeMs += Date.now() - dupAssignStartedAt

      assignedArticles += applied.length
      for (const id of applied) unhandledArticleIds.delete(id)
      for (const id of ownershipMoved) unhandledArticleIds.delete(id)

      // Per-article handleClusteringFailure so each failure carries
      // its own message into the DLQ row (see parallel fix in
      // persistPass1Assignments).
      if (failed.length > 0) {
        for (const { id, message } of failed) {
          errors.push(
            `Failed to assign article ${id} to existing story: ${message}`
          )
          unhandledArticleIds.delete(id)
          await handleClusteringFailure(
            client,
            [id],
            `Failed to assign to duplicate story ${duplicateStoryId}: ${message}`,
            owner,
            emitter
          )
        }
      }

      if (applied.length > 0) {
        const existing = storyMap.get(duplicateStoryId)
        if (existing) {
          existing.articleIds.push(...applied)
        }
        storiesNeedingReassembly.add(duplicateStoryId)
      }
      continue
    }

    // Create new story + assign articles atomically. If any step fails,
    // the RPC rolls back the transaction and no orphan story remains.
    const firstPublished = claimableArticles
      .filter((article) => cluster.articleIds.includes(article.id))
      .map((article) => article.published_at)
      .sort()[0] ?? now.toISOString()

    const createStartedAt = Date.now()
    const createOutcome = await createStoryWithArticles(
      client,
      {
        headline: 'Pending headline generation',
        story_kind: 'standard',
        topic: 'politics',
        source_count: 0,
        image_url: cluster.imageUrl,
        cluster_centroid: centroid,
        assembly_status: 'pending',
        publication_status: 'draft',
        review_status: 'pending',
        review_reasons: [],
        first_published: firstPublished,
      },
      cluster.articleIds,
      owner
    )
    dbTimeMs += Date.now() - createStartedAt

    if (createOutcome.kind === 'ownership_moved') {
      // Benign — the claim moved for one or more articles in the
      // cluster. Migration 045 raises P0010 when the owner-scoped
      // UPDATE inside the RPC matches fewer rows than requested, so
      // this whole cluster is effectively handed off to whichever
      // worker now holds those claims. Use the first article id as a
      // stable `itemId` (consumers of `pipeline_stage_events` expect
      // one per row) and include the full `articleIds` array in the
      // payload so operators can see the complete cluster.
      await safeEmit(emitter, {
        stage: 'cluster',
        level: 'info',
        eventType: 'ownership_moved',
        itemId: cluster.articleIds[0],
        payload: {
          phase: 'new_cluster',
          previousOwner: owner,
          articleCount: cluster.articleIds.length,
          articleIds: cluster.articleIds,
          detail: createOutcome.detail,
        },
      })
      for (const id of cluster.articleIds) {
        unhandledArticleIds.delete(id)
      }
      continue
    }

    if (createOutcome.kind === 'error') {
      errors.push(`Failed to create story: ${createOutcome.message}`)
      await handleClusteringFailure(
        client,
        cluster.articleIds,
        `Create-story failed: ${createOutcome.message}`,
        owner,
        emitter
      )
      for (const id of cluster.articleIds) {
        unhandledArticleIds.delete(id)
      }
      continue
    }

    // createOutcome.kind === 'created'
    const newStoryId = createOutcome.storyId
    newStories++
    assignedArticles += cluster.articleIds.length
    for (const id of cluster.articleIds) {
      unhandledArticleIds.delete(id)
    }

    storyMap.set(newStoryId, {
      centroid,
      articleIds: [...cluster.articleIds],
    })
  }

  return { newStories, assignedArticles, unmatchedSingletons, promotedSingletons, dbTimeMs }
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

export async function clusterArticles(
  client: SupabaseClient<Database>,
  maxArticles = 1000,
  owner: ClaimOwner = generateClaimOwner(),
  emitter: StageEventEmitter = noopStageEmitter
): Promise<ClusterResult> {
  const now = new Date()
  const errors: string[] = []
  let dbTimeMs = 0
  const storyMap = new Map<string, StoryTracker>()
  const storiesNeedingReassembly = new Set<string>()

  // Two cleanup queues. Every claimed article ID lives in exactly one
  // of these sets until the claim is confirmed released — either via
  // the happy-path writes inside the work block, via the atomic
  // failure RPC (retry treatment), or via the clean release helper.
  //
  //   - unhandledArticleIds: articles that attempted real clustering
  //     work and either failed or are waiting for a happy-path write.
  //     Routed through handleClusteringFailure (retry + DLQ).
  //   - cleanReleaseArticleIds: articles whose claims need to be
  //     cleared WITHOUT burning retry budget — e.g., the fetch
  //     filtered them out (null embedding) or the fetch returned
  //     zero rows. Routed through releaseClusteringClaims.
  //
  // CRITICAL INVARIANTS:
  //   1. Every claimed ID enters one set before any throwable work.
  //   2. IDs are NEVER removed from a set until their release has
  //      been confirmed successful.
  //   3. The dedicated cleanup phase below processes both sets and
  //      throws loudly on any failure so the pipeline step cannot
  //      silently "succeed" with stranded claims.
  const unhandledArticleIds = new Set<string>()
  const cleanReleaseArticleIds = new Set<string>()

  let primaryResult: ClusterResult | null = null
  let primaryError: unknown = null

  try {
    /* --- Stage 1: Atomically claim a clustering batch --- */
    const { claimedIds, dbTimeMs: claimDbTimeMs } = await claimClusteringIds(
      client,
      owner,
      maxArticles
    )
    dbTimeMs += claimDbTimeMs

    if (claimedIds.length === 0) {
      primaryResult = {
        newStories: 0,
        updatedStories: 0,
        assignedArticles: 0,
        unmatchedSingletons: 0,
        promotedSingletons: 0,
        expiredArticles: 0,
        errors,
        dbTimeMs,
      }
    } else {
      /* --- Stage 2: Fetch the full rows for the claimed IDs --- */
      // Register every claimed ID for retry-treatment cleanup before
      // awaiting the fetch. A throw here leaves them in the retry set
      // for the cleanup phase. We'll move the subset that clustering
      // never actually processes to the clean-release set below.
      for (const id of claimedIds) {
        unhandledArticleIds.add(id)
      }

      const fetchResult = await fetchClaimedClusterRows(client, claimedIds)
      dbTimeMs += fetchResult.dbTimeMs
      const claimableArticles = fetchResult.claimableArticles

      // Any claimed IDs that did NOT survive the fetch filter (null
      // embedding, concurrent delete) move to the clean-release queue.
      const claimableIdSet = new Set(claimableArticles.map((a) => a.id))
      for (const id of claimedIds) {
        if (!claimableIdSet.has(id)) {
          unhandledArticleIds.delete(id)
          cleanReleaseArticleIds.add(id)
        }
      }

      // Try to release the filtered/non-processable claims INLINE,
      // right now, before the long clustering work begins. Known-bad
      // rows should never be held across the whole run — if the
      // worker crashes during matching/persist/reassembly, those
      // claims would otherwise sit until the 30-minute TTL expiry.
      //
      // Invariant: if ANY filtered ID cannot be released cleanly
      // here, the work phase is a hard stop. Continuing would
      // reopen the stranding window for the unreleased IDs. Before
      // throwing we also move the surviving claimable IDs OUT of
      // the retry-treatment queue and into the clean-release queue
      // — clustering never actually ran on them, so the cleanup
      // phase must not burn their retry budget via the atomic
      // failure RPC. The throw hands control to the cleanup phase
      // (via primaryError); the cleanup phase retries the release
      // and either succeeds (clean run with a thrown primary error)
      // or fails loudly with the wrapper.
      if (cleanReleaseArticleIds.size > 0) {
        const filteredIds = Array.from(cleanReleaseArticleIds)
        const { failed } = await releaseClusteringClaims(client, filteredIds, owner)
        if (failed.length === 0) {
          cleanReleaseArticleIds.clear()
        } else {
          // Remove the ones that succeeded; failed IDs stay in the
          // set for the cleanup phase to retry.
          const failedIds = new Set(failed.map((f) => f.id))
          for (const id of filteredIds) {
            if (!failedIds.has(id)) {
              cleanReleaseArticleIds.delete(id)
            }
          }
          // Move surviving claimable IDs to the clean-release queue
          // so the cleanup phase doesn't burn retry budget on them.
          // Clustering was never attempted for any of these rows.
          for (const article of claimableArticles) {
            unhandledArticleIds.delete(article.id)
            cleanReleaseArticleIds.add(article.id)
          }
          throw new Error(
            `Inline clean-release failed for ${failed.length} claim(s); ` +
              `aborting work phase to avoid stranding: ` +
              failed.map((f) => `${f.id}: ${f.message}`).join('; ')
          )
        }
      }

      if (claimableArticles.length === 0) {
        // Zero claimable articles: all claims went to cleanReleaseArticleIds.
        // The cleanup phase will release them and throw if release fails.
        primaryResult = {
          newStories: 0,
          updatedStories: 0,
          assignedArticles: 0,
          unmatchedSingletons: 0,
          promotedSingletons: 0,
          expiredArticles: 0,
          errors,
          dbTimeMs,
        }
      } else {
        /* --- Load existing stories for Pass 1 --- */
        const broadCutoff = new Date(
          now.getTime() - STANDARD_MATCH_WINDOW_HOURS * 60 * 60 * 1000
        ).toISOString()

        const { data: existingStoryRows, error: storyError } = await client
          .from('stories')
          .select('id, cluster_centroid, last_updated')
          .gte('last_updated', broadCutoff)
          .not('cluster_centroid', 'is', null)
          .returns<StoryWithCentroidRow[]>()

        if (storyError) {
          throw new Error(`Failed to fetch existing stories: ${storyError.message}`)
        }

        const existingStories: StoryWithCentroid[] = (existingStoryRows ?? [])
          .filter((row) => row.cluster_centroid !== null)
          .filter((row) => shouldStoryBeMatchable(row.last_updated, now))
          .map((row) => ({
            ...row,
            cluster_centroid: parseVector(row.cluster_centroid),
          }))

        for (const story of existingStories) {
          storyMap.set(story.id, {
            centroid: story.cluster_centroid,
            articleIds: [],
          })
        }

        /* --- Pass 1: Match against existing stories --- */
        const { pass1Assignments, unmatchedArticles } = await matchAgainstExistingStories(
          client,
          claimableArticles,
          storyMap,
          SIMILARITY_THRESHOLD,
          broadCutoff,
          emitter
        )

        /* --- Pass 2: Union-find clustering of unmatched articles --- */
        const newClusters = clusterUnmatchedArticles(unmatchedArticles, SIMILARITY_THRESHOLD)

        /* --- Persist Pass 1 assignments --- */
        const pass1Result = await persistPass1Assignments(
          client,
          pass1Assignments,
          storyMap,
          unhandledArticleIds,
          storiesNeedingReassembly,
          errors,
          owner,
          emitter
        )
        let assignedArticles = pass1Result.assignedArticles
        dbTimeMs += pass1Result.dbTimeMs

        /* --- Persist new clusters --- */
        const clusterResult = await persistNewClusters(
          client,
          newClusters,
          claimableArticles,
          storyMap,
          storiesNeedingReassembly,
          unhandledArticleIds,
          errors,
          now,
          owner,
          emitter
        )

        assignedArticles += clusterResult.assignedArticles
        dbTimeMs += clusterResult.dbTimeMs

        /* --- Queue reassembly (guarded) --- */
        await queueStoriesForReassembly(
          client,
          Array.from(storiesNeedingReassembly),
          errors
        )

        primaryResult = {
          newStories: clusterResult.newStories,
          updatedStories: storiesNeedingReassembly.size,
          assignedArticles,
          unmatchedSingletons: clusterResult.unmatchedSingletons,
          promotedSingletons: clusterResult.promotedSingletons,
          expiredArticles: 0,
          errors,
          dbTimeMs,
        }
      }
    }
  } catch (err) {
    primaryError = err
  }

  /* ---------------------------------------------------------------- */
  /*  Dedicated cleanup phase                                         */
  /* ---------------------------------------------------------------- */
  // Runs regardless of primary outcome. Processes both cleanup queues
  // and collects cleanup errors. After the cleanup phase we decide
  // which error (primary vs cleanup) to surface. Cleanup failures
  // MUST throw when the primary path was otherwise successful —
  // otherwise the pipeline runner sees a returned result and marks
  // the step "successful" while claims are stranded.

  const cleanupErrors: string[] = []

  if (cleanReleaseArticleIds.size > 0) {
    const ids = Array.from(cleanReleaseArticleIds)
    try {
      const { failed } = await releaseClusteringClaims(client, ids, owner)
      const stillFailing: Array<{ id: string; message: string }> = []
      const ownershipMovedIds: string[] = []

      if (failed.length === 0) {
        cleanReleaseArticleIds.clear()
      } else {
        // Fallback path: the release RPC is broken (missing,
        // permission error, etc.) but the articles table may still
        // be reachable. Issue an owner-scoped direct UPDATE with
        // `{ count: 'exact' }` so we can distinguish three outcomes
        // and MIRROR the RPC contract:
        //   1. error → fallback genuinely failed; keep in recovery set
        //   2. count > 0 → confirmed release; claim cleared
        //   3. count === 0 → row missing or owner moved since the RPC
        //      call; claim is no longer ours to release. We remove
        //      the ID from the recovery set (nothing to retry) and
        //      log a diagnostic so operators see the anomaly.
        const resolvedViaFallback = new Set<string>()
        for (const f of failed) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: fbError, count: fbCount } = await (client.from('articles') as any)
              .update(
                {
                  clustering_claimed_at: null,
                  clustering_claim_owner: null,
                },
                { count: 'exact' }
              )
              .eq('id', f.id)
              .eq('clustering_claim_owner', owner)

            if (fbError) {
              stillFailing.push({
                id: f.id,
                message: `${f.message}; fallback UPDATE also failed: ${fbError.message}`,
              })
            } else if (typeof fbCount === 'number' && fbCount === 0) {
              // Count=0 is ambiguous: it could be (a) row missing,
              // (b) another worker reclaimed after TTL, or (c) RLS
              // policy / permission drift that prevents us from
              // clearing an owner-matching row. Do an explicit
              // verification read so we only declare success when
              // the claim is positively gone.
              //
              // Architectural assumption: the pipeline always runs
              // under the Supabase service role (via
              // getSupabaseServiceClient). Service role bypasses
              // RLS, so the verify SELECT below cannot be filtered
              // by a read policy — `data: null` unambiguously means
              // the row does not exist in the articles table. If
              // this stage is ever called from a non-service-role
              // client (e.g., an anon RLS path), the `!verifyData`
              // branch would become theoretically ambiguous and
              // would need a SECURITY DEFINER RPC instead. Call
              // sites: app/api/cron/process/route.ts,
              // app/api/admin/pipeline/trigger/route.ts — both
              // wire getSupabaseServiceClient() explicitly.
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const verify = (client.from('articles') as any)
                  .select('clustering_claim_owner')
                  .eq('id', f.id)
                const withLimit = typeof verify.maybeSingle === 'function'
                  ? verify.maybeSingle()
                  : typeof verify.single === 'function'
                    ? verify.single()
                    : verify
                const { data: verifyData, error: verifyError } = await withLimit

                if (verifyError) {
                  stillFailing.push({
                    id: f.id,
                    message:
                      `${f.message}; fallback UPDATE count=0 and verify read failed: ${verifyError.message}`,
                  })
                } else if (!verifyData) {
                  // Row genuinely missing — claim is gone.
                  resolvedViaFallback.add(f.id)
                  ownershipMovedIds.push(f.id)
                } else {
                  const currentOwner = (verifyData as { clustering_claim_owner: string | null })
                    .clustering_claim_owner
                  if (currentOwner === null || currentOwner !== owner) {
                    // Another worker holds the claim (or it's been
                    // cleared by someone else). Not our concern.
                    resolvedViaFallback.add(f.id)
                    ownershipMovedIds.push(f.id)
                  } else {
                    // Claim is still ours but the UPDATE matched
                    // zero rows. This means the write layer is
                    // broken — policy drift, permission, etc. Fail
                    // loud so operators see the schema-level issue
                    // rather than silently stranding the claim.
                    stillFailing.push({
                      id: f.id,
                      message:
                        `${f.message}; fallback UPDATE matched zero rows but claim still ` +
                        `held by this owner — suspected policy / permission drift`,
                    })
                  }
                }
              } catch (verifyErr) {
                stillFailing.push({
                  id: f.id,
                  message:
                    `${f.message}; fallback UPDATE count=0 and verify read threw: ` +
                    (verifyErr instanceof Error ? verifyErr.message : String(verifyErr)),
                })
              }
            } else {
              // count > 0 or count undefined (client doesn't report
              // count but no error) → treat as confirmed release.
              resolvedViaFallback.add(f.id)
            }
          } catch (fbErr) {
            stillFailing.push({
              id: f.id,
              message:
                `${f.message}; fallback UPDATE threw: ` +
                (fbErr instanceof Error ? fbErr.message : String(fbErr)),
            })
          }
        }

        // Clear entries that went through either the RPC or the
        // fallback path (including the count=0 "not ours" branch).
        const failedIds = new Set(failed.map((f) => f.id))
        for (const id of ids) {
          if (!failedIds.has(id) || resolvedViaFallback.has(id)) {
            cleanReleaseArticleIds.delete(id)
          }
        }

        if (ownershipMovedIds.length > 0) {
          // Non-fatal diagnostic: surface via errors[] so the
          // operator sees which claims had moved between the RPC
          // and fallback attempts. This is not a cleanup failure;
          // the claim is already gone from our perspective.
          errors.push(
            `Clean-release fallback observed ${ownershipMovedIds.length} claim(s) ` +
              `with no matching owner (row missing or reclaimed): ` +
              ownershipMovedIds.join(', ')
          )
        }

        if (stillFailing.length > 0) {
          cleanupErrors.push(
            `Failed to release ${stillFailing.length} clustering claim(s) ` +
              `(tried RPC and direct UPDATE fallback): ` +
              stillFailing.map((f) => `${f.id}: ${f.message}`).join('; ')
          )
        }
      }
    } catch (err) {
      cleanupErrors.push(
        `Clean-release cleanup threw: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  if (unhandledArticleIds.size > 0) {
    const leftoverIds = Array.from(unhandledArticleIds)
    try {
      await handleClusteringFailure(
        client,
        leftoverIds,
        'Unexpected clustering pipeline error; claim reclaimed by cleanup phase',
        owner,
        emitter
      )
      // Only clear after confirmed success — a throw leaves these IDs
      // in the set so an operator can see exactly what was stranded.
      unhandledArticleIds.clear()
    } catch (err) {
      cleanupErrors.push(
        `Retry-treatment cleanup failed for ${leftoverIds.length} claim(s): ` +
          (err instanceof Error ? err.message : String(err))
      )
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Error resolution                                                */
  /* ---------------------------------------------------------------- */
  // Primary error always wins. If no primary error but cleanup
  // failed, we throw with the cleanup errors so the pipeline runner
  // marks this step as errored instead of success-with-stranded-claims.

  if (primaryError) {
    if (cleanupErrors.length > 0) {
      console.error(
        '[clustering] Secondary cleanup errors after primary failure:',
        cleanupErrors.join('; ')
      )
      await safeEmit(emitter, {
        stage: 'cluster',
        level: 'error',
        eventType: 'cleanup_fallback_failed',
        payload: {
          error: cleanupErrors.join('; '),
          articleIds: Array.from(unhandledArticleIds),
        },
      })
    }
    throw primaryError
  }

  if (cleanupErrors.length > 0) {
    throw new Error(
      `Clustering cleanup phase failed; claims may be stranded until TTL expiry: ` +
        cleanupErrors.join('; ')
    )
  }

  if (!primaryResult) {
    // Defensive: should be unreachable because either primaryResult
    // or primaryError is always populated.
    throw new Error('Clustering run ended without a result and no error')
  }

  return primaryResult
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

export { cosineSimilarity, computeCentroid, clusterUnmatchedArticles, interleaveBySource, matchArticleViaJs, parseVector, SIMILARITY_THRESHOLD, SPLIT_THRESHOLD }
