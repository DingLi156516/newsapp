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

const SIMILARITY_THRESHOLD = 0.78
const TIME_WINDOW_HOURS = 72

interface EmbeddedArticleRow {
  id: string
  title: string
  source_id: string
  embedding: string | number[]
  published_at: string
  story_id: string | null
  image_url: string | null
}

interface EmbeddedArticle {
  id: string
  title: string
  source_id: string
  embedding: number[]
  published_at: string
  story_id: string | null
  image_url: string | null
}

interface StoryWithCentroidRow {
  id: string
  cluster_centroid: string | number[]
}

interface StoryWithCentroid {
  id: string
  cluster_centroid: number[]
}

function parseVector(v: string | number[]): number[] {
  if (Array.isArray(v)) return v
  return JSON.parse(v) as number[]
}

export interface ClusterResult {
  readonly newStories: number
  readonly updatedStories: number
  readonly assignedArticles: number
  readonly errors: readonly string[]
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

export async function clusterArticles(
  client: SupabaseClient<Database>
): Promise<ClusterResult> {
  const cutoff = new Date(Date.now() - TIME_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  const { data: unassignedRows, error: fetchError } = await client
    .from('articles')
    .select('id, title, source_id, embedding, published_at, story_id, image_url')
    .eq('is_embedded', true)
    .is('story_id', null)
    .gte('published_at', cutoff)
    .order('published_at', { ascending: true })
    .returns<EmbeddedArticleRow[]>()

  if (fetchError) {
    throw new Error(`Failed to fetch unassigned articles: ${fetchError.message}`)
  }

  if (!unassignedRows || unassignedRows.length === 0) {
    return { newStories: 0, updatedStories: 0, assignedArticles: 0, errors: [] }
  }

  const unassigned: EmbeddedArticle[] = unassignedRows
    .filter((row) => row.embedding !== null)
    .map((row) => ({
      ...row,
      embedding: parseVector(row.embedding),
    }))

  const { data: existingStoryRows, error: storyError } = await client
    .from('stories')
    .select('id, cluster_centroid')
    .gte('last_updated', cutoff)
    .not('cluster_centroid', 'is', null)
    .returns<StoryWithCentroidRow[]>()

  if (storyError) {
    throw new Error(`Failed to fetch existing stories: ${storyError.message}`)
  }

  const errors: string[] = []
  let newStories = 0
  let updatedStories = 0
  let assignedArticles = 0

  const storyMap = new Map<string, { centroid: number[]; articleIds: string[] }>()

  const existingStories: StoryWithCentroid[] = (existingStoryRows ?? [])
    .filter((row) => row.cluster_centroid !== null)
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

  const newClusters: Array<{ articleIds: string[]; embeddings: number[][]; imageUrl: string | null }> = []

  for (const article of unassigned) {
    if (!article.embedding) continue

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
      storyMap.get(bestStoryId)!.articleIds.push(article.id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (client.from('articles') as any)
        .update({ story_id: bestStoryId })
        .eq('id', article.id)

      if (error) {
        errors.push(`Failed to assign article ${article.id}: ${error.message}`)
      } else {
        assignedArticles++
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
    if (cluster.articleIds.length < 2) continue

    const centroid = computeCentroid(cluster.embeddings)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: storyData, error: insertError } = await (client.from('stories') as any)
      .insert({
        headline: 'Pending headline generation',
        topic: 'politics' as const,
        source_count: cluster.articleIds.length,
        image_url: cluster.imageUrl,
        cluster_centroid: centroid,
        first_published: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError || !storyData) {
      errors.push(`Failed to create story: ${insertError?.message ?? 'no data returned'}`)
      continue
    }

    newStories++

    for (const articleId of cluster.articleIds) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (client.from('articles') as any)
        .update({ story_id: storyData.id })
        .eq('id', articleId)

      if (error) {
        errors.push(`Failed to assign article ${articleId}: ${error.message}`)
      } else {
        assignedArticles++
      }
    }
  }

  for (const [, storyData] of storyMap) {
    if (storyData.articleIds.length > 0) {
      updatedStories++
    }
  }

  return { newStories, updatedStories, assignedArticles, errors }
}

export { cosineSimilarity, computeCentroid }
