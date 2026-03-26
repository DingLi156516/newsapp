/**
 * lib/ai/clustering.ts — Greedy nearest-neighbor article clustering.
 *
 * Groups articles by cosine similarity of their embeddings within a time
 * window. Articles with similarity > threshold are placed in the same
 * cluster (story). New articles are matched against existing story
 * centroids first, then against each other.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { ARTICLE_STAGE_CLAIM_TTL_MS, isClaimAvailable } from '@/lib/pipeline/claim-utils'

const SIMILARITY_THRESHOLD = 0.72
const STANDARD_MATCH_WINDOW_HOURS = 168
const CLAIM_SCAN_MULTIPLIER = 3
const MAX_CLUSTERING_ATTEMPTS = 3

interface EmbeddedArticleRow {
  id: string
  title: string
  source_id: string
  embedding: string | number[]
  published_at: string
  created_at: string
  story_id: string | null
  image_url: string | null
  clustering_claimed_at: string | null
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
  clustering_claimed_at: string | null
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

export interface ClusterResult {
  readonly newStories: number
  readonly updatedStories: number
  readonly assignedArticles: number
  readonly unmatchedSingletons: number
  readonly promotedSingletons: number
  readonly expiredArticles: number
  readonly errors: readonly string[]
}

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

async function clearClusteringClaim(client: SupabaseClient<Database>, articleId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from('articles') as any)
    .update({ clustering_claimed_at: null })
    .eq('id', articleId)
}

async function queueStoryForReassembly(
  client: SupabaseClient<Database>,
  storyId: string,
  nowIso: string
): Promise<{ error: { message: string } | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client.from('stories') as any)
    .update({
      assembly_status: 'pending',
      publication_status: 'draft',
      review_status: 'pending',
      review_reasons: [],
      published_at: null,
      assembly_claimed_at: null,
      last_updated: nowIso,
    })
    .eq('id', storyId)
}

export async function clusterArticles(
  client: SupabaseClient<Database>,
  maxArticles = 1000
): Promise<ClusterResult> {
  const now = new Date()
  const broadCutoff = new Date(
    now.getTime() - STANDARD_MATCH_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString()

  const { data: fetchedRows, error: fetchError } = await client
    .from('articles')
    .select('id, title, source_id, embedding, published_at, created_at, story_id, image_url, clustering_claimed_at, clustering_attempts')
    .eq('is_embedded', true)
    .is('story_id', null)
    .eq('clustering_status', 'pending')
    .order('published_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(maxArticles * CLAIM_SCAN_MULTIPLIER)
    .returns<EmbeddedArticleRow[]>()

  if (fetchError) {
    throw new Error(`Failed to fetch unassigned articles: ${fetchError.message}`)
  }

  if (!fetchedRows || fetchedRows.length === 0) {
    return {
      newStories: 0,
      updatedStories: 0,
      assignedArticles: 0,
      unmatchedSingletons: 0,
      promotedSingletons: 0,
      expiredArticles: 0,
      errors: [],
    }
  }

  const unassigned: EmbeddedArticle[] = fetchedRows
    .filter((row) => isClaimAvailable(row.clustering_claimed_at, ARTICLE_STAGE_CLAIM_TTL_MS))
    .filter((row) => row.embedding !== null)
    .map((row) => ({
      ...row,
      embedding: parseVector(row.embedding),
    }))
    .slice(0, maxArticles)

  if (unassigned.length === 0) {
    return {
      newStories: 0,
      updatedStories: 0,
      assignedArticles: 0,
      unmatchedSingletons: 0,
      promotedSingletons: 0,
      expiredArticles: 0,
      errors: [],
    }
  }

  const claimedAt = now.toISOString()
  for (const article of unassigned) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from('articles') as any)
      .update({ clustering_claimed_at: claimedAt })
      .eq('id', article.id)
  }

  const { data: existingStoryRows, error: storyError } = await client
    .from('stories')
    .select('id, cluster_centroid, last_updated')
    .gte('last_updated', broadCutoff)
    .not('cluster_centroid', 'is', null)
    .returns<StoryWithCentroidRow[]>()

  if (storyError) {
    throw new Error(`Failed to fetch existing stories: ${storyError.message}`)
  }

  const errors: string[] = []
  let newStories = 0
  let assignedArticles = 0
  let unmatchedSingletons = 0
  let promotedSingletons = 0

  const storyMap = new Map<string, StoryTracker>()
  const storiesNeedingReassembly = new Set<string>()

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

  const newClusters: ClusterCandidate[] = []

  for (const article of unassigned) {
    let bestStoryId: string | null = null
    let bestSimilarity = 0

    for (const [existingStoryId, storyData] of storyMap) {
      const sim = cosineSimilarity(article.embedding, storyData.centroid)
      if (sim > bestSimilarity && sim >= SIMILARITY_THRESHOLD) {
        bestSimilarity = sim
        bestStoryId = existingStoryId
      }
    }

    if (bestStoryId) {
      const tracker = storyMap.get(bestStoryId)
      tracker?.articleIds.push(article.id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (client.from('articles') as any)
        .update({ story_id: bestStoryId, clustering_claimed_at: null, clustering_status: 'clustered' })
        .eq('id', article.id)

      if (error) {
        errors.push(`Failed to assign article ${article.id}: ${error.message}`)
        await clearClusteringClaim(client, article.id)
      } else {
        assignedArticles++

        storiesNeedingReassembly.add(bestStoryId)
      }

      continue
    }

    let addedToNewCluster = false
    for (const cluster of newClusters) {
      const clusterCentroid = computeCentroid(cluster.embeddings)
      const sim = cosineSimilarity(article.embedding, clusterCentroid)
      if (sim >= SIMILARITY_THRESHOLD) {
        cluster.articleIds.push(article.id)
        cluster.embeddings.push(article.embedding)
        if (!cluster.imageUrl && article.image_url) {
          cluster.imageUrl = article.image_url
        }
        addedToNewCluster = true
        break
      }
    }

    if (!addedToNewCluster) {
      newClusters.push({
        articleIds: [article.id],
        embeddings: [article.embedding],
        imageUrl: article.image_url,
      })
    }
  }

  for (const cluster of newClusters) {
    if (cluster.articleIds.length < 2) {
      const article = unassigned.find(a => a.id === cluster.articleIds[0])!
      const newAttempts = (article.clustering_attempts ?? 0) + 1

      if (newAttempts >= MAX_CLUSTERING_ATTEMPTS) {
        // Promote: create single-article story
        const centroid = cluster.embeddings[0]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: singletonStoryData, error: insertError } = await (client.from('stories') as any)
          .insert({
            headline: 'Pending headline generation',
            story_kind: 'standard',
            topic: 'politics' as const,
            source_count: 0,
            image_url: cluster.imageUrl,
            cluster_centroid: centroid,
            assembly_status: 'pending',
            publication_status: 'draft',
            review_status: 'pending',
            review_reasons: [],
            first_published: article.published_at,
          })
          .select('id').single()

        if (!insertError && singletonStoryData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updateError } = await (client.from('articles') as any)
            .update({
              story_id: singletonStoryData.id,
              clustering_claimed_at: null,
              clustering_attempts: newAttempts,
              clustering_status: 'clustered',
            })
            .eq('id', article.id)

          if (updateError) {
            errors.push(`Failed to assign promoted singleton ${article.id}: ${updateError.message}`)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (client.from('stories') as any).delete().eq('id', singletonStoryData.id)
            await clearClusteringClaim(client, article.id)
          } else {
            promotedSingletons++
            assignedArticles++
            newStories++
            storyMap.set(singletonStoryData.id, { centroid, articleIds: [article.id] })
          }
        } else {
          errors.push(`Failed to promote singleton ${article.id}: ${insertError?.message}`)
          await clearClusteringClaim(client, article.id)
        }
      } else {
        // Increment counter and release back to pool
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client.from('articles') as any)
          .update({ clustering_claimed_at: null, clustering_attempts: newAttempts })
          .eq('id', article.id)
        unmatchedSingletons++
      }
      continue
    }

    const centroid = computeCentroid(cluster.embeddings)

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
      for (const articleId of cluster.articleIds) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (client.from('articles') as any)
          .update({ story_id: duplicateStoryId, clustering_claimed_at: null, clustering_status: 'clustered' })
          .eq('id', articleId)

        if (error) {
          errors.push(`Failed to assign article ${articleId} to existing story: ${error.message}`)
          await clearClusteringClaim(client, articleId)
        } else {
          assignedArticles++
        }
      }

      const existing = storyMap.get(duplicateStoryId)
      if (existing) {
        existing.articleIds.push(...cluster.articleIds)
      }
      storiesNeedingReassembly.add(duplicateStoryId)
      continue
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: storyData, error: insertError } = await (client.from('stories') as any)
      .insert({
        headline: 'Pending headline generation',
        story_kind: 'standard',
        topic: 'politics' as const,
        source_count: 0,
        image_url: cluster.imageUrl,
        cluster_centroid: centroid,
        assembly_status: 'pending',
        publication_status: 'draft',
        review_status: 'pending',
        review_reasons: [],
        first_published: unassigned
          .filter((article) => cluster.articleIds.includes(article.id))
          .map((article) => article.published_at)
          .sort()[0] ?? now.toISOString(),
      })
      .select('id')
      .single()

    if (insertError || !storyData) {
      errors.push(`Failed to create story: ${insertError?.message ?? 'no data returned'}`)
      for (const articleId of cluster.articleIds) {
        await clearClusteringClaim(client, articleId)
      }
      continue
    }

    newStories++

    for (const articleId of cluster.articleIds) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (client.from('articles') as any)
        .update({ story_id: storyData.id, clustering_claimed_at: null, clustering_status: 'clustered' })
        .eq('id', articleId)

      if (error) {
        errors.push(`Failed to assign article ${articleId}: ${error.message}`)
        await clearClusteringClaim(client, articleId)
      } else {
        assignedArticles++
      }
    }

    storyMap.set(storyData.id, {
      centroid,
      articleIds: [...cluster.articleIds],
    })
  }

  const nowIso = now.toISOString()
  for (const storyId of storiesNeedingReassembly) {
    const { error } = await queueStoryForReassembly(client, storyId, nowIso)
    if (error) {
      errors.push(`Failed to queue story ${storyId} for reassembly: ${error.message}`)
    }
  }

  return {
    newStories,
    updatedStories: storiesNeedingReassembly.size,
    assignedArticles,
    unmatchedSingletons,
    promotedSingletons,
    expiredArticles: 0,
    errors,
  }
}

export { cosineSimilarity, computeCentroid }
