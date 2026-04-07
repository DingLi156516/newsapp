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
import { ASSEMBLY_CLAIM_TTL_MS, isClaimAvailable } from '@/lib/pipeline/claim-utils'
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
  nowIso: string,
  cutoffIso: string
): Promise<PhaseResult> {
  let mergedPairs = 0
  const errors: string[] = []
  const deletedIds = new Set<string>()
  const availableIds = new Set(stories.map(s => s.id))

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
      console.warn('recluster: pgvector RPC unavailable, falling back to JS:', rpcErr instanceof Error ? rpcErr.message : String(rpcErr))
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

      // Capture source article IDs before reassignment for potential rollback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sourceArticleRows } = await (client.from('articles') as any)
        .select('id')
        .eq('story_id', sourceId)

      const sourceArticleIds = (sourceArticleRows ?? []).map((a: { id: string }) => a.id)

      // Reassign articles from source to target
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: reassignError } = await (client.from('articles') as any)
        .update({ story_id: targetId })
        .eq('story_id', sourceId)

      if (reassignError) {
        errors.push(`Failed to reassign articles from story ${sourceId} to ${targetId}: ${reassignError.message}`)
        continue
      }

      // Fetch all articles for the merged story to recompute centroid
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: mergedArticles, error: fetchError } = await (client.from('articles') as any)
        .select('embedding')
        .eq('story_id', targetId)
        .not('embedding', 'is', null)

      if (fetchError) {
        errors.push(`Failed to fetch articles for centroid recompute on story ${targetId}: ${fetchError.message}`)
      }

      // Fallback: use the surviving (target) story's centroid, not the outer-loop story
      const targetStory = stories.find(s => s.id === targetId)
      const fallbackCentroid = targetStory
        ? parseVector(targetStory.cluster_centroid)
        : parseVector(story.cluster_centroid)

      const newCentroid = (!fetchError && mergedArticles && mergedArticles.length > 0)
        ? computeCentroid((mergedArticles as ArticleRow[]).map((a) => parseVector(a.embedding)))
        : fallbackCentroid

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (client.from('stories') as any)
        .update({
          cluster_centroid: newCentroid,
          assembly_status: 'pending',
          publication_status: 'draft',
          review_status: 'pending',
          review_reasons: [],
          published_at: null,
          assembly_claimed_at: null,
          last_updated: nowIso,
        })
        .eq('id', targetId)

      if (updateError) {
        errors.push(`Failed to update centroid for story ${targetId}: ${updateError.message}`)

        // Compensating rollback: move articles back to source so it isn't left empty
        if (sourceArticleIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: rollbackError } = await (client.from('articles') as any)
            .update({ story_id: sourceId })
            .in('id', sourceArticleIds)

          if (rollbackError) {
            errors.push(`Failed to rollback article reassignment to story ${sourceId}: ${rollbackError.message}`)
          }
        }

        continue
      }

      // Delete the source story
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (client.from('stories') as any)
        .delete()
        .eq('id', sourceId)

      if (deleteError) {
        errors.push(`Failed to delete merged story ${sourceId}: ${deleteError.message}`)
      } else {
        deletedIds.add(sourceId)
        mergedPairs++

        // Current story was merged away — stop processing its candidates
        if (sourceId === story.id) break
      }
    }
  }

  return { count: mergedPairs, errors }
}

/* ------------------------------------------------------------------ */
/*  Split detection                                                    */
/* ------------------------------------------------------------------ */

async function detectAndSplitArticles(
  client: SupabaseClient<Database>,
  stories: readonly StoryRow[],
  nowIso: string
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

    // Queue story for reassembly with updated centroid
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: queueError } = await (client.from('stories') as any)
      .update({
        cluster_centroid: newCentroid,
        assembly_status: 'pending',
        publication_status: 'draft',
        review_status: 'pending',
        review_reasons: [],
        published_at: null,
        assembly_claimed_at: null,
        last_updated: nowIso,
      })
      .eq('id', story.id)

    if (queueError) {
      errors.push(`Failed to queue reassembly for story ${story.id}: ${queueError.message}`)
    }
  }

  return { count: splitArticles, errors }
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

export async function reclusterRecentStories(
  client: SupabaseClient<Database>,
  windowHours = DEFAULT_WINDOW_HOURS
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
    (s) => isClaimAvailable(s.assembly_claimed_at, ASSEMBLY_CLAIM_TTL_MS)
  )

  if (availableStories.length === 0) {
    return { mergedPairs: 0, splitArticles: 0, errors: [] }
  }

  const nowIso = new Date().toISOString()

  // Run merge detection first, then split detection
  const mergeResult = await detectAndMergeStories(client, availableStories, nowIso, cutoff)

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
        (s) => isClaimAvailable(s.assembly_claimed_at, ASSEMBLY_CLAIM_TTL_MS)
      )
    }
  }

  const splitResult = await detectAndSplitArticles(client, storiesForSplit, nowIso)

  return {
    mergedPairs: mergeResult.count,
    splitArticles: splitResult.count,
    errors: [...mergeResult.errors, ...splitResult.errors],
  }
}
