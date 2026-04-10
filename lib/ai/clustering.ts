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
import {
  claimClusteringBatch,
  generateClaimOwner,
  releaseClusteringClaim,
  type ClaimOwner,
} from '@/lib/pipeline/claim-utils'
import { fetchAssemblyVersions, requeueStoryForReassembly } from '@/lib/pipeline/reassembly'
import { createStoryWithArticles } from '@/lib/pipeline/cluster-writes'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SIMILARITY_THRESHOLD = Number(process.env.CLUSTERING_SIMILARITY_THRESHOLD ?? 0.70)
const SPLIT_THRESHOLD = Number(process.env.CLUSTERING_SPLIT_THRESHOLD ?? 0.60)
const PGVECTOR_CANDIDATE_COUNT = Number(process.env.CLUSTERING_CANDIDATE_COUNT ?? 15)
const STANDARD_MATCH_WINDOW_HOURS = 168
const MAX_CLUSTERING_ATTEMPTS = 3
const PGVECTOR_BATCH_SIZE = Number(process.env.CLUSTERING_PGVECTOR_BATCH_SIZE ?? 25)

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
  imageUrl: string | null
}

export interface ClusterableArticle {
  readonly id: string
  readonly embedding: number[]
  readonly image_url: string | null
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

function computeCentroid(vectors: readonly (readonly number[])[]): number[] {
  if (vectors.length === 0) return []

  const dim = vectors[0].length
  const centroid = new Array<number>(dim).fill(0)

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

async function clearClusteringClaim(
  client: SupabaseClient<Database>,
  articleId: string,
  owner: ClaimOwner
): Promise<void> {
  await releaseClusteringClaim(client, articleId, owner)
}

async function bulkUpdateArticles(
  client: SupabaseClient<Database>,
  articleIds: readonly string[],
  payload: Record<string, unknown>
): Promise<{ failedIds: string[]; message?: string }> {
  if (articleIds.length === 0) {
    return { failedIds: [] }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query = (client.from('articles') as any).update(payload)
    if (typeof query.in === 'function') {
      const { error } = await query.in('id', articleIds)
      if (!error) {
        return { failedIds: [] }
      }
      return { failedIds: [...articleIds], message: error.message }
    }
  } catch (error) {
    return {
      failedIds: [...articleIds],
      message: error instanceof Error ? error.message : String(error),
    }
  }

  const failedIds: string[] = []
  let firstMessage: string | undefined

  for (const articleId of articleIds) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from('articles') as any).update(payload).eq('id', articleId)
    if (error) {
      failedIds.push(articleId)
      firstMessage ??= error.message
    }
  }

  return { failedIds, message: firstMessage }
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

async function claimAndFetchArticles(
  client: SupabaseClient<Database>,
  owner: ClaimOwner,
  maxArticles: number
): Promise<{ claimableArticles: EmbeddedArticle[]; errors: string[]; dbTimeMs: number }> {
  const claimStartedAt = Date.now()
  const claimedIds = await claimClusteringBatch(client, owner, maxArticles)
  const claimDbTimeMs = Date.now() - claimStartedAt

  if (claimedIds.length === 0) {
    return { claimableArticles: [], errors: [], dbTimeMs: claimDbTimeMs }
  }

  const fetchStartedAt = Date.now()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = (client.from('articles') as any)
    .select('id, title, source_id, embedding, published_at, created_at, story_id, image_url, clustering_attempts')

  const withFilter = typeof query.in === 'function' ? query.in('id', claimedIds) : query
  const { data: fetchedData, error: fetchError } = await withFilter
  const fetchedRows = (fetchedData as EmbeddedArticleRow[] | null) ?? []
  const fetchDbTimeMs = Date.now() - fetchStartedAt

  if (fetchError) {
    // Release all claims so a subsequent run can retry.
    await Promise.all(
      claimedIds.map((id) => releaseClusteringClaim(client, id, owner))
    )
    throw new Error(`Failed to fetch claimed clustering batch: ${fetchError.message}`)
  }

  if (fetchedRows.length === 0) {
    return { claimableArticles: [], errors: [], dbTimeMs: claimDbTimeMs + fetchDbTimeMs }
  }

  const claimable = fetchedRows
    .filter((row: EmbeddedArticleRow) => row.embedding !== null)
    .map((row: EmbeddedArticleRow) => ({
      ...row,
      embedding: parseVector(row.embedding),
    }))

  // Round-robin interleave by source_id for downstream diversity.
  const claimableArticles = interleaveBySource(claimable)

  return {
    claimableArticles,
    errors: [],
    dbTimeMs: claimDbTimeMs + fetchDbTimeMs,
  }
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
  cutoffIso: string
): Promise<{ pass1Assignments: Map<string, string[]>; unmatchedArticles: EmbeddedArticle[] }> {
  const pass1Assignments = new Map<string, string[]>()
  const unmatchedArticles: EmbeddedArticle[] = []

  let useRpc = true

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
            console.warn('pgvector RPC unavailable, falling back to JS brute-force:', rpcErr instanceof Error ? rpcErr.message : String(rpcErr))
            useRpc = false
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
 */
function clusterUnmatchedArticles(
  articles: readonly ClusterableArticle[],
  threshold: number
): ClusterCandidate[] {
  const n = articles.length
  if (n === 0) return []

  // --- 1. Compute all pairwise similarities above threshold ---
  const pairs: { i: number; j: number; sim: number }[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(articles[i].embedding, articles[j].embedding)
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
      const article = articles[members[0]]
      clusters.push({
        articleIds: [article.id],
        embeddings: [article.embedding],
        imageUrl: article.image_url,
      })
      continue
    }

    const embeddings = members.map((i) => articles[i].embedding)
    const centroid = computeCentroid(embeddings)

    const valid: number[] = []
    const ejected: number[] = []

    for (const idx of members) {
      const sim = cosineSimilarity(articles[idx].embedding, centroid)
      if (sim >= threshold) {
        valid.push(idx)
      } else {
        ejected.push(idx)
      }
    }

    if (valid.length > 0) {
      clusters.push({
        articleIds: valid.map((i) => articles[i].id),
        embeddings: valid.map((i) => articles[i].embedding),
        imageUrl: valid.map((i) => articles[i].image_url).find((u) => u !== null) ?? null,
      })
    }

    // Ejected articles become singletons
    for (const idx of ejected) {
      const article = articles[idx]
      clusters.push({
        articleIds: [article.id],
        embeddings: [article.embedding],
        imageUrl: article.image_url,
      })
    }
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
    const { data: allArticles, error: selectError } = await client
      .from('articles')
      .select('embedding')
      .eq('story_id', storyId)
      .not('embedding', 'is', null)
      .returns<{ embedding: string | number[] }[]>()

    if (selectError) {
      errors.push(
        `Failed to fetch embeddings for centroid recomputation of story ${storyId}: ${selectError.message}`
      )
      return Date.now() - startedAt
    }

    if (!allArticles || allArticles.length <= 1) {
      return Date.now() - startedAt
    }

    const embeddings = allArticles.map((a) => parseVector(a.embedding))
    const newCentroid = computeCentroid(embeddings)
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
  owner: ClaimOwner
): Promise<{ assignedArticles: number; dbTimeMs: number }> {
  let assignedArticles = 0
  let dbTimeMs = 0

  for (const [storyId, articleIds] of pass1Assignments) {
    const batchStartedAt = Date.now()
    const { failedIds, message } = await bulkUpdateArticles(client, articleIds, {
      story_id: storyId,
      clustering_claimed_at: null,
      clustering_claim_owner: null,
      clustering_status: 'clustered',
    })
    dbTimeMs += Date.now() - batchStartedAt

    if (failedIds.length > 0) {
      const failedSet = new Set(failedIds)
      for (const aid of articleIds) {
        if (failedSet.has(aid)) {
          errors.push(`Failed to assign article ${aid}: ${message ?? 'unknown error'}`)
          await clearClusteringClaim(client, aid, owner)
          unhandledArticleIds.delete(aid)
        } else {
          assignedArticles++
          unhandledArticleIds.delete(aid)
        }
      }
    } else {
      assignedArticles += articleIds.length
      articleIds.forEach((id) => unhandledArticleIds.delete(id))
    }

    if (articleIds.length > failedIds.length) {
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
  owner: ClaimOwner
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
        try {
          const newStoryId = await createStoryWithArticles(
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
            [article.id]
          )
          dbTimeMs += Date.now() - createStartedAt

          // Even though create_story_with_articles set story_id + cleared the
          // claim fields, we still need to bump clustering_attempts for the
          // retry budget. Issue a follow-up UPDATE for that single column.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (client.from('articles') as any)
            .update({ clustering_attempts: newAttempts })
            .eq('id', article.id)

          promotedSingletons++
          assignedArticles++
          newStories++
          storyMap.set(newStoryId, { centroid, articleIds: [article.id] })
          unhandledArticleIds.delete(article.id)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          errors.push(`Failed to promote singleton ${article.id}: ${message}`)
          await clearClusteringClaim(client, article.id, owner)
          unhandledArticleIds.delete(article.id)
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client.from('articles') as any)
          .update({
            clustering_claimed_at: null,
            clustering_claim_owner: null,
            clustering_attempts: newAttempts,
          })
          .eq('id', article.id)
        unmatchedSingletons++
        unhandledArticleIds.delete(article.id)
      }
      continue
    }

    /* --- Multi-article cluster handling --- */
    const centroid = computeCentroid(cluster.embeddings)

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
      const { failedIds, message } = await bulkUpdateArticles(client, cluster.articleIds, {
        story_id: duplicateStoryId,
        clustering_claimed_at: null,
        clustering_claim_owner: null,
        clustering_status: 'clustered',
      })
      dbTimeMs += Date.now() - dupAssignStartedAt

      if (failedIds.length > 0) {
        for (const articleId of failedIds) {
          errors.push(`Failed to assign article ${articleId} to existing story: ${message ?? 'unknown error'}`)
          await clearClusteringClaim(client, articleId, owner)
          unhandledArticleIds.delete(articleId)
        }
        assignedArticles += cluster.articleIds.length - failedIds.length
        cluster.articleIds.filter((id) => !failedIds.includes(id)).forEach((id) => unhandledArticleIds.delete(id))
      } else {
        assignedArticles += cluster.articleIds.length
        cluster.articleIds.forEach((id) => unhandledArticleIds.delete(id))
      }

      if (cluster.articleIds.length > failedIds.length) {
        const existing = storyMap.get(duplicateStoryId)
        if (existing) {
          const successfulIds = cluster.articleIds.filter((id) => !failedIds.includes(id))
          existing.articleIds.push(...successfulIds)
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
    let newStoryId: string
    try {
      newStoryId = await createStoryWithArticles(
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
        cluster.articleIds
      )
      dbTimeMs += Date.now() - createStartedAt
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Failed to create story: ${message}`)
      for (const articleId of cluster.articleIds) {
        await clearClusteringClaim(client, articleId, owner)
        unhandledArticleIds.delete(articleId)
      }
      continue
    }

    newStories++
    assignedArticles += cluster.articleIds.length
    cluster.articleIds.forEach((id) => unhandledArticleIds.delete(id))

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
  owner: ClaimOwner = generateClaimOwner()
): Promise<ClusterResult> {
  const now = new Date()

  /* --- Atomically claim + fetch articles --- */
  const claimResult = await claimAndFetchArticles(client, owner, maxArticles)
  const { claimableArticles } = claimResult
  const errors = [...claimResult.errors]
  let dbTimeMs = claimResult.dbTimeMs

  if (claimableArticles.length === 0) {
    return {
      newStories: 0,
      updatedStories: 0,
      assignedArticles: 0,
      unmatchedSingletons: 0,
      promotedSingletons: 0,
      expiredArticles: 0,
      errors,
      dbTimeMs,
    }
  }

  const storyMap = new Map<string, StoryTracker>()
  const storiesNeedingReassembly = new Set<string>()
  const unhandledArticleIds = new Set(claimableArticles.map((a) => a.id))

  try {
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

    /* --- Pass 1: Match against existing stories (pgvector + JS fallback) --- */
    const { pass1Assignments, unmatchedArticles } = await matchAgainstExistingStories(
      client,
      claimableArticles,
      storyMap,
      SIMILARITY_THRESHOLD,
      broadCutoff
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
      owner
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
      owner
    )

    assignedArticles += clusterResult.assignedArticles
    dbTimeMs += clusterResult.dbTimeMs

    /* --- Queue reassembly (guarded) --- */
    await queueStoriesForReassembly(
      client,
      Array.from(storiesNeedingReassembly),
      errors
    )

    return {
      newStories: clusterResult.newStories,
      updatedStories: storiesNeedingReassembly.size,
      assignedArticles,
      unmatchedSingletons: clusterResult.unmatchedSingletons,
      promotedSingletons: clusterResult.promotedSingletons,
      expiredArticles: 0,
      errors,
      dbTimeMs,
    }
  } finally {
    if (unhandledArticleIds.size > 0) {
      const leftoverIds = Array.from(unhandledArticleIds)
      await Promise.all(
        leftoverIds.map((id) => releaseClusteringClaim(client, id, owner))
      ).catch((err) => console.error('Failed to release claims in finally block', err))
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

export { cosineSimilarity, computeCentroid, clusterUnmatchedArticles, interleaveBySource, matchArticleViaJs, parseVector, SIMILARITY_THRESHOLD, SPLIT_THRESHOLD }
