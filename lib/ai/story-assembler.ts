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
import { generateAISummary, generateSingleSourceSummary, isFallbackSummary, type ExpandedSummaryResult } from '@/lib/ai/summary-generator'
import {
  computeStoryVelocity,
  computeSourceDiversity,
  computeImpactScore,
  computeControversyScore,
  computeCoverageDurationHours,
} from '@/lib/ai/story-metrics'
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
  published_at: string | null
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

export interface AssembleStoriesOptions {
  readonly concurrency?: number
}

interface PendingStory {
  id: string
  assembly_claimed_at: string | null
  first_published: string
}

interface SingleStoryAssemblyResult {
  readonly publicationStatus: 'published' | 'needs_review' | 'draft' | 'rejected'
  readonly dbTimeMs?: number
  readonly modelTimeMs?: number
  readonly cheapModelTasks?: number
  readonly cheapModelFallbacks?: number
  readonly summaryFallback?: boolean
  readonly tagError?: string
}

interface StoryAssemblyBatchResult {
  readonly storyId: string
  readonly result?: SingleStoryAssemblyResult
  readonly error?: string
  readonly failureDbTimeMs?: number
}

const CLAIM_SCAN_MULTIPLIER = 3
const DEFAULT_STORY_ASSEMBLY_CONCURRENCY = Math.max(
  1,
  Number(process.env.PIPELINE_ASSEMBLY_CONCURRENCY ?? 3)
)

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

// nextIndex mutation is safe: Node.js is single-threaded, and each worker
// awaits between increments so no two workers read nextIndex in the same tick.
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
  storyId: string,
  firstPublished?: string
): Promise<SingleStoryAssemblyResult> {
  let dbTimeMs = 0
  let modelTimeMs = 0

  const articlesStartedAt = Date.now()
  const { data: articles, error: articlesError } = await client
    .from('articles')
    .select('id, title, description, source_id, image_url, published_at')
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

  // Compute pre-AI metrics (velocity, diversity) from article timestamps
  const articlesWithTimestamps = articles
    .filter((a) => a.published_at !== null)
    .map((a) => ({ published_at: a.published_at! }))

  // Use first_published from caller when available (batch assembly path),
  // fall back to a DB query for direct calls (e.g., admin reprocess)
  let storyCreatedAt: string = firstPublished ?? ''
  if (!storyCreatedAt) {
    const storyMetaStartedAt = Date.now()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: storyMeta } = await (client.from('stories') as any)
      .select('first_published')
      .eq('id', storyId)
      .single()
    dbTimeMs += Date.now() - storyMetaStartedAt
    storyCreatedAt = storyMeta?.first_published ?? new Date().toISOString()
  }
  const assemblyNow = new Date()
  const storyVelocity = computeStoryVelocity(articlesWithTimestamps, storyCreatedAt, assemblyNow)

  const ownerships = (sources ?? []).map((source) => source.ownership)
  const sourceDiversity = computeSourceDiversity(ownerships)

  const isSingleSource = sourceIds.length === 1
  const modelStartedAt = Date.now()

  let normalizedHeadline: { headline: string; usedCheapModel: boolean; usedFallback: boolean }
  let normalizedTopic: { topic: string; usedCheapModel: boolean; usedFallback: boolean }
  let normalizedRegion: { region: string; usedCheapModel: boolean; usedFallback: boolean }
  let summaryResult: ExpandedSummaryResult

  if (isSingleSource) {
    // Single-source path: skip headline generation, use lightweight summary
    const article = articles[0]
    const [topicRes, regionRes, singleSummary] = await Promise.all([
      classifyTopic(titles),
      classifyRegion(titles),
      generateSingleSourceSummary({
        title: article.title,
        description: article.description,
        bias: sourceMap.get(article.source_id)?.bias ?? 'center',
      }),
    ])
    normalizedHeadline = { headline: article.title, usedCheapModel: false, usedFallback: false }
    normalizedTopic = topicRes
    normalizedRegion = regionRes
    summaryResult = singleSummary
  } else {
    // Multi-source path: full AI pipeline
    const [headlineRes, topicRes, regionRes, fullSummary] = await Promise.all([
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
    normalizedHeadline = headlineRes
    normalizedTopic = topicRes
    normalizedRegion = regionRes
    summaryResult = fullSummary
  }

  modelTimeMs += Date.now() - modelStartedAt

  const { aiSummary, sentiment, keyQuotes, keyClaims } = summaryResult

  const spectrumSegments = calculateSpectrum(biases)
  const blindspot = isSingleSource ? false : isBlindspot(spectrumSegments)
  const factualities = (sources ?? []).map((source) => source.factuality)
  const imageUrl = articles.find((article) => article.image_url)?.image_url ?? null

  // Compute post-AI metrics (impact, controversy)
  const coverageDuration = computeCoverageDurationHours(articlesWithTimestamps)
  const impactScore = computeImpactScore(
    sourceIds.length,
    storyVelocity.articles_24h,
    coverageDuration,
    sourceDiversity
  )
  const controversyScore = isSingleSource ? 0 : computeControversyScore(aiSummary)

  const publicationDecision = decideStoryPublication({
    articleCount: articles.length,
    sourceCount: sourceIds.length,
    isBlindspot: blindspot,
    factuality: dominantValue<FactualityLevel>(factualities, 'mixed'),
    aiSummary,
    processingError: null,
  })
  const now = new Date().toISOString()

  let tagError: string | undefined
  try {
    const entities = await entitiesPromise
    const tagsStartedAt = Date.now()
    await upsertStoryTags(client, storyId, entities)
    dbTimeMs += Date.now() - tagsStartedAt
  } catch (tagErr) {
    tagError = `Entity tagging failed for ${storyId}: ${tagErr instanceof Error ? tagErr.message : String(tagErr)}`
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
      story_velocity: storyVelocity,
      impact_score: impactScore,
      source_diversity: sourceDiversity,
      controversy_score: controversyScore,
      sentiment,
      key_quotes: keyQuotes,
      key_claims: keyClaims,
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
    summaryFallback: isFallbackSummary(summaryResult),
    tagError,
  }
}

export async function assembleStories(
  client: SupabaseClient<Database>,
  maxStories = 50,
  options?: AssembleStoriesOptions
): Promise<AssemblyResult> {
  const { data: fetchedStories, error: fetchError } = await client
    .from('stories')
    .select('id, assembly_claimed_at, first_published')
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
  const concurrency = Math.max(
    1,
    Math.min(claimedStories, Math.floor(options?.concurrency ?? DEFAULT_STORY_ASSEMBLY_CONCURRENCY))
  )

  const claimStartedAt = Date.now()
  await claimStories(client, pendingStories.map((story) => story.id), claimedAt)
  dbTimeMs += Date.now() - claimStartedAt

  const batchResults = await mapWithConcurrency<PendingStory, StoryAssemblyBatchResult>(
    pendingStories,
    concurrency,
    async (story) => {
      try {
        const result = await assembleSingleStory(client, story.id, story.first_published)
        return { storyId: story.id, result }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const formattedMessage = `Story assembly failed for ${story.id}: ${message}`
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
        return { storyId: story.id, error: formattedMessage, failureDbTimeMs: Date.now() - failureStartedAt }
      }
    }
  )

  for (const batchResult of batchResults) {
    if (batchResult.error) {
      errors.push(batchResult.error)
      dbTimeMs += batchResult.failureDbTimeMs ?? 0
      continue
    }

    if (!batchResult.result) {
      continue
    }

    storiesProcessed += 1
    dbTimeMs += batchResult.result.dbTimeMs ?? 0
    modelTimeMs += batchResult.result.modelTimeMs ?? 0
    cheapModelTasks += batchResult.result.cheapModelTasks ?? 0
    cheapModelFallbacks += batchResult.result.cheapModelFallbacks ?? 0
    summaryFallbacks += batchResult.result.summaryFallback ? 1 : 0

    if (batchResult.result.tagError) {
      errors.push(batchResult.result.tagError)
    }

    if (batchResult.result.publicationStatus === 'published') {
      autoPublished += 1
    } else if (batchResult.result.publicationStatus === 'needs_review') {
      sentToReview += 1
    }
  }

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
