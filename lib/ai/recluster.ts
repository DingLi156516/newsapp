/**
 * lib/ai/recluster.ts — Re-clustering maintenance job.
 *
 * Corrects accumulated clustering errors by:
 * 1. Merge detection — finds story pairs with similar centroids and merges smaller into larger
 * 2. Split detection — ejects articles below split threshold from their story centroid
 *
 * Designed to run hourly via cron. Respects pipeline claim TTLs to avoid
 * interfering with concurrent processing.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { ASSEMBLY_CLAIM_TTL_MS } from '@/lib/pipeline/claim-utils'
import { fetchAssemblyVersions, requeueStoryForReassembly } from '@/lib/pipeline/reassembly'
import { mergeStories } from '@/lib/pipeline/cluster-writes'
import {
  noopStageEmitter,
  safeEmit,
  type StageEventEmitter,
} from '@/lib/pipeline/stage-events'

/**
 * Returns true if a claim timestamp is absent or older than the TTL.
 * Used only by the recluster maintenance cron, which does not hold its own
 * pipeline claim lease; it skips stories an assembler is actively claiming.
 */
function isClaimExpired(
  claimedAt: string | null | undefined,
  ttlMs: number,
  nowMs = Date.now()
): boolean {
  if (!claimedAt) return true
  const claimedMs = new Date(claimedAt).getTime()
  if (Number.isNaN(claimedMs)) return true
  return nowMs - claimedMs >= ttlMs
}
import { cosineSimilarity, computeCentroid, parseVector, SIMILARITY_THRESHOLD, SPLIT_THRESHOLD } from '@/lib/ai/clustering'

const DEFAULT_WINDOW_HOURS = 24
const PGVECTOR_MERGE_CANDIDATE_COUNT = Number(process.env.CLUSTERING_CANDIDATE_COUNT ?? 5)

export interface ReclusterResult {
  readonly mergedPairs: number
  readonly splitArticles: number
  readonly errors: readonly string[]
}

interface StoryRow {
  id: string
  cluster_centroid: string | number[]
  last_updated: string
  assembly_claimed_at: string | null
}

interface ArticleRow {
  id: string
  embedding: string | number[]
}

/* ------------------------------------------------------------------ */
/*  Merge detection                                                    */
/* ------------------------------------------------------------------ */

interface PhaseResult {
  readonly count: number
  readonly errors: readonly string[]
}

async function detectAndMergeStories(
  client: SupabaseClient<Database>,
  stories: readonly StoryRow[],
  cutoffIso: string,
  emitter: StageEventEmitter
): Promise<PhaseResult> {
  let mergedPairs = 0
  const errors: string[] = []
  const deletedIds = new Set<string>()
  const availableIds = new Set(stories.map(s => s.id))
  // Emit at most ONE pgvector_fallback event per recluster run. Without
  // this flag, the per-story loop below would write a warn event for
  // every story in the window during an RPC outage — polluting the
  // event stream with thousands of duplicate rows exactly when the
  // pipeline is already degraded.
  let fallbackEmitted = false

  // For each story, find similar stories via RPC
  for (const story of stories) {
    if (deletedIds.has(story.id)) continue

    const centroid = parseVector(story.cluster_centroid)
    let candidates: { story_id: string; similarity: number }[] = []

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (client as any).rpc('match_story_centroid', {
        query_embedding: centroid,
        match_threshold: SIMILARITY_THRESHOLD,
        match_count: PGVECTOR_MERGE_CANDIDATE_COUNT,
        cutoff_time: cutoffIso,
      })

      if (error) throw new Error(error.message)
      candidates = (data ?? []) as { story_id: string; similarity: number }[]
    } catch (rpcErr) {
      const rpcMessage = rpcErr instanceof Error ? rpcErr.message : String(rpcErr)
      console.warn('recluster: pgvector RPC unavailable, falling back to JS:', rpcMessage)
      if (!fallbackEmitted) {
        fallbackEmitted = true
        await safeEmit(emitter, {
          stage: 'recluster',
          level: 'warn',
          eventType: 'pgvector_fallback',
          payload: { error: rpcMessage },
        })
      }
      // Fall back to JS comparison against other stories in window
      for (const other of stories) {
        if (other.id === story.id || deletedIds.has(other.id)) continue
        const otherCentroid = parseVector(other.cluster_centroid)
        const sim = cosineSimilarity(centroid, otherCentroid)
        if (sim >= SIMILARITY_THRESHOLD) {
          candidates.push({ story_id: other.id, similarity: sim })
        }
      }
    }

    for (const candidate of candidates) {
      if (candidate.story_id === story.id) continue
      if (deletedIds.has(candidate.story_id)) continue
      if (!availableIds.has(candidate.story_id)) continue

      // Determine which story is larger by counting articles
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: storyCount, error: storyCountErr } = await (client.from('articles') as any)
        .select('id', { count: 'exact', head: true })
        .eq('story_id', story.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: candidateCount, error: candidateCountErr } = await (client.from('articles') as any)
        .select('id', { count: 'exact', head: true })
        .eq('story_id', candidate.story_id)

      if (storyCountErr || candidateCountErr) {
        errors.push(`Failed to count articles for merge: ${(storyCountErr ?? candidateCountErr)!.message}`)
        continue
      }

      // Merge smaller into larger (break ties by keeping current story)
      const storyIsLarger = (storyCount ?? 0) >= (candidateCount ?? 0)
      const targetId = storyIsLarger ? story.id : candidate.story_id
      const sourceId = storyIsLarger ? candidate.story_id : story.id

      // Fetch source articles + their embeddings in ONE query so we can
      // compute the post-merge centroid without a second round-trip after
      // reassignment. We then also need the current target embeddings.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sourceEmbeddings, error: sourceFetchError } = await (client.from('articles') as any)
        .select('id, embedding')
        .eq('story_id', sourceId)
        .not('embedding', 'is', null)

      if (sourceFetchError) {
        errors.push(`Failed to fetch source articles for merge of ${sourceId}: ${sourceFetchError.message}`)
        continue
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: targetEmbeddings, error: targetFetchError } = await (client.from('articles') as any)
        .select('embedding')
        .eq('story_id', targetId)
        .not('embedding', 'is', null)

      if (targetFetchError) {
        errors.push(`Failed to fetch target articles for merge of ${targetId}: ${targetFetchError.message}`)
      }

      // Fallback centroid: use the surviving target story's centroid.
      const targetStory = stories.find((s) => s.id === targetId)
      const fallbackCentroid = targetStory
        ? parseVector(targetStory.cluster_centroid)
        : parseVector(story.cluster_centroid)

      const allEmbeddings = [
        ...((sourceEmbeddings ?? []) as ArticleRow[]).map((a) => parseVector(a.embedding)),
        ...((targetEmbeddings ?? []) as ArticleRow[]).map((a) => parseVector(a.embedding)),
      ]

      const newCentroid = allEmbeddings.length > 0
        ? computeCentroid(allEmbeddings)
        : fallbackCentroid

      // Read assembly_version BEFORE the merge so the guarded requeue
      // can use a consistent version.
      let expectedVersion: number | undefined
      try {
        const versions = await fetchAssemblyVersions(client, [targetId])
        expectedVersion = versions.get(targetId)
      } catch (err) {
        errors.push(`Failed to read assembly_version for story ${targetId}: ${err instanceof Error ? err.message : String(err)}`)
      }

      // Atomic merge: reassign articles, update target centroid, delete
      // source — all inside a single transaction. If any step fails, the
      // RPC rolls back the entire merge so no orphan/empty story remains.
      try {
        await mergeStories(client, targetId, sourceId, newCentroid)
      } catch (err) {
        errors.push(`Failed to merge story ${sourceId} into ${targetId}: ${err instanceof Error ? err.message : String(err)}`)
        continue
      }

      // Guarded requeue: only reset assembly state if no assembler is
      // currently processing the target story.
      if (expectedVersion !== undefined) {
        try {
          const requeued = await requeueStoryForReassembly(client, targetId, expectedVersion)
          if (!requeued) {
            errors.push(
              `Merge target ${targetId} requeue guarded: currently processing or version mismatch`
            )
          }
        } catch (err) {
          errors.push(`Failed to requeue merge target ${targetId}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      deletedIds.add(sourceId)
      mergedPairs++

      // Current story was merged away — stop processing its candidates
      if (sourceId === story.id) break
    }
  }

  return { count: mergedPairs, errors }
}

/* ------------------------------------------------------------------ */
/*  Split detection                                                    */
/* ------------------------------------------------------------------ */

async function detectAndSplitArticles(
  client: SupabaseClient<Database>,
  stories: readonly StoryRow[]
): Promise<PhaseResult> {
  let splitArticles = 0
  const errors: string[] = []

  for (const story of stories) {
    const centroid = parseVector(story.cluster_centroid)

    // Fetch articles with embeddings for this story
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: articles, error: fetchError } = await (client.from('articles') as any)
      .select('id, embedding')
      .eq('story_id', story.id)
      .not('embedding', 'is', null)

    if (fetchError || !articles || articles.length === 0) continue

    const toDetach: string[] = []

    for (const article of articles as ArticleRow[]) {
      const embedding = parseVector(article.embedding)
      const sim = cosineSimilarity(embedding, centroid)
      if (sim < SPLIT_THRESHOLD) {
        toDetach.push(article.id)
      }
    }

    if (toDetach.length === 0) continue

    // Detach misassigned articles — reset for re-clustering
    const successfullyDetached: string[] = []
    for (const articleId of toDetach) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: detachError } = await (client.from('articles') as any)
        .update({
          story_id: null,
          clustering_status: 'pending',
          clustering_attempts: 0,
          clustering_claimed_at: null,
        })
        .eq('id', articleId)

      if (detachError) {
        errors.push(`Failed to detach article ${articleId} from story ${story.id}: ${detachError.message}`)
      } else {
        successfullyDetached.push(articleId)
        splitArticles++
      }
    }

    if (successfullyDetached.length === 0) continue

    // Recompute centroid from remaining articles
    const detachSet = new Set(successfullyDetached)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: remaining, error: remainingErr } = await (client.from('articles') as any)
      .select('id, embedding')
      .eq('story_id', story.id)
      .not('embedding', 'is', null)

    if (remainingErr) {
      errors.push(`Failed to fetch remaining articles for story ${story.id}: ${remainingErr.message}`)
    }

    const remainingArticles = (remaining ?? []).filter(
      (a: ArticleRow) => !detachSet.has(a.id)
    )

    const newCentroid = remainingArticles.length > 0
      ? computeCentroid(remainingArticles.map((a: ArticleRow) => parseVector(a.embedding)))
      : parseVector(story.cluster_centroid)

    // Read assembly_version BEFORE mutating so we can guard the reset below.
    let expectedVersion: number | undefined
    try {
      const versions = await fetchAssemblyVersions(client, [story.id])
      expectedVersion = versions.get(story.id)
    } catch (err) {
      errors.push(`Failed to read assembly_version for story ${story.id}: ${err instanceof Error ? err.message : String(err)}`)
    }

    // Update centroid first (isolated write).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: queueError } = await (client.from('stories') as any)
      .update({ cluster_centroid: newCentroid })
      .eq('id', story.id)

    if (queueError) {
      errors.push(`Failed to update centroid after split for story ${story.id}: ${queueError.message}`)
      continue
    }

    // Guarded requeue: skip if assembler is currently processing.
    if (expectedVersion !== undefined) {
      try {
        const requeued = await requeueStoryForReassembly(client, story.id, expectedVersion)
        if (!requeued) {
          errors.push(
            `Split path requeue for story ${story.id} guarded: currently processing or version mismatch`
          )
        }
      } catch (err) {
        errors.push(`Failed to requeue split story ${story.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  return { count: splitArticles, errors }
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

export async function reclusterRecentStories(
  client: SupabaseClient<Database>,
  windowHours = DEFAULT_WINDOW_HOURS,
  emitter: StageEventEmitter = noopStageEmitter
): Promise<ReclusterResult> {
  const cutoff = new Date(
    Date.now() - windowHours * 60 * 60 * 1000
  ).toISOString()

  // Fetch stories with centroids updated within window
  const { data: storyRows, error: fetchError } = await client
    .from('stories')
    .select('id, cluster_centroid, last_updated, assembly_claimed_at')
    .gte('last_updated', cutoff)
    .not('cluster_centroid', 'is', null)
    .returns<StoryRow[]>()

  if (fetchError) {
    throw new Error(`Failed to fetch stories for re-clustering: ${fetchError.message}`)
  }

  if (!storyRows || storyRows.length === 0) {
    return { mergedPairs: 0, splitArticles: 0, errors: [] }
  }

  // Filter out stories currently claimed by pipeline.
  // Note: TOCTOU race exists — a pipeline worker could claim a story after this
  // check. Accepted risk: row-level locking would be disproportionate for an
  // hourly maintenance cron that already filters by claim TTL.
  const availableStories = storyRows.filter(
    (s) => isClaimExpired(s.assembly_claimed_at, ASSEMBLY_CLAIM_TTL_MS)
  )

  if (availableStories.length === 0) {
    return { mergedPairs: 0, splitArticles: 0, errors: [] }
  }

  // Run merge detection first, then split detection
  const mergeResult = await detectAndMergeStories(client, availableStories, cutoff, emitter)

  // Re-fetch stories if merges occurred — centroids may have changed
  let storiesForSplit = availableStories
  if (mergeResult.count > 0) {
    const { data: refreshedRows, error: refreshError } = await client
      .from('stories')
      .select('id, cluster_centroid, last_updated, assembly_claimed_at')
      .gte('last_updated', cutoff)
      .not('cluster_centroid', 'is', null)
      .returns<StoryRow[]>()

    if (!refreshError && refreshedRows) {
      storiesForSplit = refreshedRows.filter(
        (s) => isClaimExpired(s.assembly_claimed_at, ASSEMBLY_CLAIM_TTL_MS)
      )
    }
  }

  const splitResult = await detectAndSplitArticles(client, storiesForSplit)

  return {
    mergedPairs: mergeResult.count,
    splitArticles: splitResult.count,
    errors: [...mergeResult.errors, ...splitResult.errors],
  }
}
