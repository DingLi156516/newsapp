/**
 * lib/ai/story-assembler.ts — Full story assembly pipeline.
 *
 * Orchestrates the AI pipeline: for each story with pending metadata,
 * fetches its articles, generates headline/summary/topic/spectrum,
 * and updates the story record.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, DbSource } from '@/lib/supabase/types'
import type { BiasCategory, FactualityLevel, OwnershipType } from '@/lib/types'
import { generateNeutralHeadline } from '@/lib/ai/headline-generator'
import { generateAISummary, isFallbackSummary } from '@/lib/ai/summary-generator'
import { classifyTopic } from '@/lib/ai/topic-classifier'
import { classifyRegion } from '@/lib/ai/region-classifier'
import { calculateSpectrum } from '@/lib/ai/spectrum-calculator'
import { isBlindspot } from '@/lib/ai/blindspot-detector'
import { extractEntities } from '@/lib/ai/entity-extractor'
import { upsertStoryTags } from '@/lib/ai/tag-upsert'
import { ASSEMBLY_CLAIM_TTL_MS, isClaimAvailable } from '@/lib/pipeline/claim-utils'
import { decideStoryPublication } from '@/lib/pipeline/story-state'

interface StoryArticle {
  id: string
  title: string
  description: string | null
  source_id: string
  image_url: string | null
}

export interface AssemblyResult {
  readonly storiesProcessed: number
  readonly claimedStories: number
  readonly autoPublished: number
  readonly sentToReview: number
  readonly errors: readonly string[]
  readonly dbTimeMs?: number
  readonly modelTimeMs?: number
  readonly cheapModelTasks?: number
  readonly cheapModelFallbacks?: number
  readonly summaryFallbacks?: number
}

interface PendingStory {
  id: string
  assembly_claimed_at: string | null
}

interface SingleStoryAssemblyResult {
  readonly publicationStatus: 'published' | 'needs_review' | 'draft' | 'rejected'
  readonly dbTimeMs?: number
  readonly modelTimeMs?: number
  readonly cheapModelTasks?: number
  readonly cheapModelFallbacks?: number
  readonly summaryFallback?: boolean
}

const CLAIM_SCAN_MULTIPLIER = 3
const STORY_ASSEMBLY_CONCURRENCY = Math.max(1, Number(process.env.PIPELINE_ASSEMBLY_CONCURRENCY ?? 3))

function normalizeHeadlineResult(
  result: Awaited<ReturnType<typeof generateNeutralHeadline>> | string
) {
  if (typeof result === 'string') {
    return {
      headline: result,
      usedCheapModel: false,
      usedFallback: false,
    }
  }

  return result
}

function normalizeTopicResult(
  result: Awaited<ReturnType<typeof classifyTopic>> | string
) {
  if (typeof result === 'string') {
    return {
      topic: result,
      usedCheapModel: false,
      usedFallback: false,
    }
  }

  return result
}

function normalizeRegionResult(
  result: Awaited<ReturnType<typeof classifyRegion>> | string
) {
  if (typeof result === 'string') {
    return {
      region: result,
      usedCheapModel: false,
      usedFallback: false,
    }
  }

  return result
}

function dominantValue<T extends string>(values: readonly T[], fallback: T): T {
  if (values.length === 0) return fallback

  const counts = new Map<T, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  let maxCount = 0
  let dominant = fallback

  for (const [value, count] of counts) {
    if (count > maxCount) {
      maxCount = count
      dominant = value
    }
  }

  return dominant
}

async function claimStories(
  client: SupabaseClient<Database>,
  storyIds: readonly string[],
  claimedAt: string
): Promise<void> {
  if (storyIds.length === 0) {
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = (client.from('stories') as any)
    .update({
      assembly_status: 'processing',
      assembly_claimed_at: claimedAt,
    })

  if (typeof query.in === 'function') {
    const { error } = await query.in('id', storyIds)
    if (error) {
      throw new Error(`Failed to claim stories for assembly: ${error.message}`)
    }
    return
  }

  for (const storyId of storyIds) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from('stories') as any)
      .update({
        assembly_status: 'processing',
        assembly_claimed_at: claimedAt,
      })
      .eq('id', storyId)

    if (error) {
      throw new Error(`Failed to claim story ${storyId}: ${error.message}`)
    }
  }
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await fn(items[currentIndex])
    }
  })

  await Promise.all(workers)
  return results
}

export async function assembleSingleStory(
  client: SupabaseClient<Database>,
  storyId: string
): Promise<SingleStoryAssemblyResult> {
  let dbTimeMs = 0
  let modelTimeMs = 0

  const articlesStartedAt = Date.now()
  const { data: articles, error: articlesError } = await client
    .from('articles')
    .select('id, title, description, source_id, image_url')
    .eq('story_id', storyId)
    .order('published_at', { ascending: false })
    .order('id', { ascending: true })
    .returns<StoryArticle[]>()
  dbTimeMs += Date.now() - articlesStartedAt

  if (articlesError) {
    throw new Error(`Failed to fetch articles for story ${storyId}: ${articlesError.message}`)
  }

  if (!articles || articles.length === 0) {
    throw new Error(`No articles found for story ${storyId}`)
  }

  const sourceIds = [...new Set(articles.map((article) => article.source_id))]
  const sourcesStartedAt = Date.now()
  const { data: sources, error: sourcesError } = await client
    .from('sources')
    .select('id, bias, factuality, ownership')
    .in('id', sourceIds)
    .returns<Array<Pick<DbSource, 'id' | 'bias' | 'factuality' | 'ownership'>>>()
  dbTimeMs += Date.now() - sourcesStartedAt

  if (sourcesError) {
    throw new Error(`Failed to fetch sources for story ${storyId}: ${sourcesError.message}`)
  }

  const sourceMap = new Map((sources ?? []).map((source) => [source.id, source]))
  const titles = articles.map((article) => article.title)
  const biases = articles
    .map((article) => sourceMap.get(article.source_id)?.bias)
    .filter((bias): bias is BiasCategory => bias !== undefined)
  const descriptions = articles.map((article) => article.description)

  const entitiesPromise = extractEntities(titles, descriptions)

  const modelStartedAt = Date.now()
  const [headlineResult, topicResult, regionResult, aiSummary] = await Promise.all([
    generateNeutralHeadline(titles),
    classifyTopic(titles),
    classifyRegion(titles),
    generateAISummary(
      articles.map((article) => ({
        title: article.title,
        description: article.description,
        bias: sourceMap.get(article.source_id)?.bias ?? 'center',
      }))
    ),
  ])
  modelTimeMs += Date.now() - modelStartedAt
  const normalizedHeadline = normalizeHeadlineResult(headlineResult)
  const normalizedTopic = normalizeTopicResult(topicResult)
  const normalizedRegion = normalizeRegionResult(regionResult)

  const spectrumSegments = calculateSpectrum(biases)
  const blindspot = isBlindspot(spectrumSegments)
  const factualities = (sources ?? []).map((source) => source.factuality)
  const ownerships = (sources ?? []).map((source) => source.ownership)
  const imageUrl = articles.find((article) => article.image_url)?.image_url ?? null
  const publicationDecision = decideStoryPublication({
    articleCount: articles.length,
    sourceCount: sourceIds.length,
    isBlindspot: blindspot,
    factuality: dominantValue<FactualityLevel>(factualities, 'mixed'),
    aiSummary,
    processingError: null,
  })
  const now = new Date().toISOString()

  try {
    const entities = await entitiesPromise
    const tagsStartedAt = Date.now()
    await upsertStoryTags(client, storyId, entities)
    dbTimeMs += Date.now() - tagsStartedAt
  } catch (tagErr) {
    console.error(
      `[story-assembler] Entity tagging failed for ${storyId}:`,
      tagErr instanceof Error ? tagErr.message : String(tagErr)
    )
  }

  const updateStartedAt = Date.now()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (client.from('stories') as any)
    .update({
      headline: normalizedHeadline.headline,
      story_kind: 'standard',
      topic: normalizedTopic.topic,
      region: normalizedRegion.region,
      source_count: sourceIds.length,
      is_blindspot: blindspot,
      image_url: imageUrl,
      factuality: dominantValue<FactualityLevel>(factualities, 'mixed'),
      ownership: dominantValue<OwnershipType>(ownerships, 'other'),
      spectrum_segments: spectrumSegments,
      ai_summary: aiSummary,
      assembly_status: 'completed',
      publication_status: publicationDecision.publicationStatus,
      review_status: publicationDecision.reviewStatus,
      review_reasons: publicationDecision.reviewReasons,
      confidence_score: publicationDecision.confidenceScore,
      processing_error: null,
      assembled_at: now,
      published_at: publicationDecision.publicationStatus === 'published' ? now : null,
      assembly_claimed_at: null,
      last_updated: now,
    })
    .eq('id', storyId)
  dbTimeMs += Date.now() - updateStartedAt

  if (updateError) {
    throw new Error(`Failed to update story ${storyId}: ${updateError.message}`)
  }

  return {
    publicationStatus: publicationDecision.publicationStatus,
    dbTimeMs,
    modelTimeMs,
    cheapModelTasks:
      (normalizedHeadline.usedCheapModel ? 1 : 0)
      + (normalizedTopic.usedCheapModel ? 1 : 0)
      + (normalizedRegion.usedCheapModel ? 1 : 0),
    cheapModelFallbacks:
      (normalizedHeadline.usedFallback ? 1 : 0)
      + (normalizedTopic.usedFallback ? 1 : 0)
      + (normalizedRegion.usedFallback ? 1 : 0),
    summaryFallback: isFallbackSummary(aiSummary),
  }
}

export async function assembleStories(
  client: SupabaseClient<Database>,
  maxStories = 50
): Promise<AssemblyResult> {
  const { data: fetchedStories, error: fetchError } = await client
    .from('stories')
    .select('id, assembly_claimed_at')
    .eq('assembly_status', 'pending')
    .order('first_published', { ascending: true })
    .order('id', { ascending: true })
    .limit(maxStories * CLAIM_SCAN_MULTIPLIER)
    .returns<PendingStory[]>()

  if (fetchError) {
    throw new Error(`Failed to fetch pending stories: ${fetchError.message}`)
  }

  if (!fetchedStories || fetchedStories.length === 0) {
    return {
      storiesProcessed: 0,
      claimedStories: 0,
      autoPublished: 0,
      sentToReview: 0,
      errors: [],
      dbTimeMs: 0,
      modelTimeMs: 0,
      cheapModelTasks: 0,
      cheapModelFallbacks: 0,
      summaryFallbacks: 0,
    }
  }

  const pendingStories = fetchedStories
    .filter((story) => isClaimAvailable(story.assembly_claimed_at, ASSEMBLY_CLAIM_TTL_MS))
    .slice(0, maxStories)

  if (pendingStories.length === 0) {
    return {
      storiesProcessed: 0,
      claimedStories: 0,
      autoPublished: 0,
      sentToReview: 0,
      errors: [],
      dbTimeMs: 0,
      modelTimeMs: 0,
      cheapModelTasks: 0,
      cheapModelFallbacks: 0,
      summaryFallbacks: 0,
    }
  }

  const errors: string[] = []
  let storiesProcessed = 0
  let autoPublished = 0
  let sentToReview = 0
  let dbTimeMs = 0
  let modelTimeMs = 0
  let cheapModelTasks = 0
  let cheapModelFallbacks = 0
  let summaryFallbacks = 0
  const claimedStories = pendingStories.length
  const claimedAt = new Date().toISOString()

  const claimStartedAt = Date.now()
  await claimStories(client, pendingStories.map((story) => story.id), claimedAt)
  dbTimeMs += Date.now() - claimStartedAt

  await mapWithConcurrency(pendingStories, STORY_ASSEMBLY_CONCURRENCY, async (story) => {
    try {
      const result = await assembleSingleStory(client, story.id)
      storiesProcessed += 1
      dbTimeMs += result.dbTimeMs ?? 0
      modelTimeMs += result.modelTimeMs ?? 0
      cheapModelTasks += result.cheapModelTasks ?? 0
      cheapModelFallbacks += result.cheapModelFallbacks ?? 0
      summaryFallbacks += result.summaryFallback ? 1 : 0

      if (result.publicationStatus === 'published') {
        autoPublished += 1
      } else if (result.publicationStatus === 'needs_review') {
        sentToReview += 1
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Story assembly failed for ${story.id}: ${message}`)
      const failureStartedAt = Date.now()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client.from('stories') as any)
        .update({
          assembly_status: 'failed',
          publication_status: 'needs_review',
          review_status: 'pending',
          review_reasons: ['assembly_failed'],
          processing_error: message,
          assembly_claimed_at: null,
          last_updated: new Date().toISOString(),
        })
        .eq('id', story.id)
      dbTimeMs += Date.now() - failureStartedAt
    }
  })

  return {
    storiesProcessed,
    claimedStories,
    autoPublished,
    sentToReview,
    errors,
    dbTimeMs,
    modelTimeMs,
    cheapModelTasks,
    cheapModelFallbacks,
    summaryFallbacks,
  }
}
