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
import { classifyStory } from '@/lib/ai/story-classifier'
import { generateAISummary, generateSingleSourceSummary, isFallbackSummary, type ExpandedSummaryResult } from '@/lib/ai/summary-generator'
import {
  computeStoryVelocity,
  computeSourceDiversity,
  computeImpactScore,
  computeControversyScore,
  computeCoverageDurationHours,
} from '@/lib/ai/story-metrics'
import { calculateSpectrum } from '@/lib/ai/spectrum-calculator'
import { isBlindspot } from '@/lib/ai/blindspot-detector'
import { extractEntities } from '@/lib/ai/entity-extractor'
import { upsertStoryTags } from '@/lib/ai/tag-upsert'
import {
  claimAssemblyBatch,
  generateClaimOwner,
  releaseAssemblyClaim,
  type ClaimOwner,
} from '@/lib/pipeline/claim-utils'
import { bumpAssemblyVersion } from '@/lib/pipeline/reassembly'
import { computeRetryOutcome } from '@/lib/pipeline/retry-policy'
import { pushToDeadLetter } from '@/lib/pipeline/dead-letter'
import { decideStoryPublication } from '@/lib/pipeline/story-state'
import {
  noopStageEmitter,
  safeEmit,
  type StageEventEmitter,
} from '@/lib/pipeline/stage-events'

export function scheduleTagExtraction(
  client: SupabaseClient<Database>,
  storyId: string,
  titles: readonly string[],
  descriptions: readonly (string | null)[],
  emitter: StageEventEmitter = noopStageEmitter
): Promise<void> {
  return extractEntities(titles, descriptions)
    .then((entities) => upsertStoryTags(client, storyId, entities))
    .then(() => {})
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err)
      console.error(
        `[tag-processor] Tag extraction failed for ${storyId}:`,
        message
      )
      // Best-effort emit — safeEmit guarantees the emitter cannot
      // throw even if a test/script passes in a rejecting function.
      void safeEmit(emitter, {
        stage: 'assemble',
        level: 'warn',
        eventType: 'tag_extraction_failed',
        itemId: storyId,
        payload: { storyId, error: message },
      })
    })
}

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
  first_published: string
}

interface SingleStoryAssemblyResult {
  readonly publicationStatus: 'published' | 'needs_review' | 'draft' | 'rejected'
  readonly dbTimeMs?: number
  readonly modelTimeMs?: number
  readonly cheapModelTasks?: number
  readonly cheapModelFallbacks?: number
  readonly summaryFallback?: boolean
  readonly tagPromise?: Promise<void>
}

interface StoryAssemblyBatchResult {
  readonly storyId: string
  readonly result?: SingleStoryAssemblyResult
  readonly error?: string
  readonly failureDbTimeMs?: number
}

const DEFAULT_STORY_ASSEMBLY_CONCURRENCY = Math.max(
  1,
  Number(process.env.PIPELINE_ASSEMBLY_CONCURRENCY ?? 12)
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

/**
 * Fetch metadata for stories we atomically claimed via the
 * `claim_stories_for_assembly` RPC. The RPC already transitioned
 * assembly_status to 'processing'; here we pull the fields the
 * assembler needs.
 */
async function fetchClaimedStoryMetadata(
  client: SupabaseClient<Database>,
  claimedIds: readonly string[]
): Promise<PendingStory[]> {
  if (claimedIds.length === 0) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = (client.from('stories') as any).select('id, first_published')
  const withFilter = typeof query.in === 'function' ? query.in('id', claimedIds) : query

  const { data, error } = await withFilter
  if (error) {
    throw new Error(`Failed to fetch claimed stories: ${error.message}`)
  }

  return (data as PendingStory[] | null) ?? []
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
  firstPublished?: string,
  emitter: StageEventEmitter = noopStageEmitter
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
    const article = articles[0]
    const [classificationRes, singleSummary] = await Promise.all([
      classifyStory(titles),
      generateSingleSourceSummary({
        title: article.title,
        description: article.description,
        bias: sourceMap.get(article.source_id)?.bias ?? 'center',
      }),
    ])
    normalizedHeadline = { headline: article.title, usedCheapModel: false, usedFallback: false }
    normalizedTopic = { topic: classificationRes.topic, usedCheapModel: classificationRes.usedCheapModel, usedFallback: classificationRes.topicFallback }
    normalizedRegion = { region: classificationRes.region, usedCheapModel: classificationRes.usedCheapModel, usedFallback: classificationRes.regionFallback }
    summaryResult = singleSummary
  } else {
    const [classificationRes, fullSummary] = await Promise.all([
      classifyStory(titles),
      generateAISummary(
        articles.map((article) => ({
          title: article.title,
          description: article.description,
          bias: sourceMap.get(article.source_id)?.bias ?? 'center',
        }))
      ),
    ])
    normalizedHeadline = { headline: classificationRes.headline, usedCheapModel: classificationRes.usedCheapModel, usedFallback: classificationRes.headlineFallback }
    normalizedTopic = { topic: classificationRes.topic, usedCheapModel: classificationRes.usedCheapModel, usedFallback: classificationRes.topicFallback }
    normalizedRegion = { region: classificationRes.region, usedCheapModel: classificationRes.usedCheapModel, usedFallback: classificationRes.regionFallback }
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
      assembly_claim_owner: null,
      last_updated: now,
    })
    .eq('id', storyId)
  dbTimeMs += Date.now() - updateStartedAt

  if (updateError) {
    throw new Error(`Failed to update story ${storyId}: ${updateError.message}`)
  }

  // Bump assembly_version so any concurrent requeue caller with a stale
  // version read will see a mismatch and skip its stale reset attempt.
  await bumpAssemblyVersion(client, storyId)

  const tagPromise = scheduleTagExtraction(client, storyId, titles, descriptions, emitter)

  return {
    publicationStatus: publicationDecision.publicationStatus,
    dbTimeMs,
    modelTimeMs,
    // Note: cheapModelTasks counts logical tasks (headline, topic, region).
    // Because classifyStory batches these into a single API call, this metric
    // will count 3 tasks for multi-source and 2 tasks for single-source
    // even though only 1 Gemini API request was made. This accurately reflects
    // "work done by cheap models" rather than "number of API requests".
    cheapModelTasks:
      (normalizedHeadline.usedCheapModel ? 1 : 0)
      + (normalizedTopic.usedCheapModel ? 1 : 0)
      + (normalizedRegion.usedCheapModel ? 1 : 0),
    cheapModelFallbacks:
      (normalizedHeadline.usedFallback ? 1 : 0)
      + (normalizedTopic.usedFallback ? 1 : 0)
      + (normalizedRegion.usedFallback ? 1 : 0),
    summaryFallback: isFallbackSummary(summaryResult),
    tagPromise,
  }
}

export async function assembleStories(
  client: SupabaseClient<Database>,
  maxStories = 50,
  options?: AssembleStoriesOptions,
  owner: ClaimOwner = generateClaimOwner(),
  emitter: StageEventEmitter = noopStageEmitter
): Promise<AssemblyResult> {
  const errors: string[] = []
  let storiesProcessed = 0
  let autoPublished = 0
  let sentToReview = 0
  let dbTimeMs = 0
  let modelTimeMs = 0
  let cheapModelTasks = 0
  let cheapModelFallbacks = 0
  let summaryFallbacks = 0

  const claimStartedAt = Date.now()
  const claimedIds = await claimAssemblyBatch(client, owner, maxStories)
  dbTimeMs += Date.now() - claimStartedAt

  if (claimedIds.length === 0) {
    return {
      storiesProcessed: 0,
      claimedStories: 0,
      autoPublished: 0,
      sentToReview: 0,
      errors: [],
      dbTimeMs,
      modelTimeMs: 0,
      cheapModelTasks: 0,
      cheapModelFallbacks: 0,
      summaryFallbacks: 0,
    }
  }

  let pendingStories: PendingStory[]
  const fetchStartedAt = Date.now()
  try {
    pendingStories = await fetchClaimedStoryMetadata(client, claimedIds)
  } catch (err) {
    // Release claims so another run can retry.
    await Promise.all(
      claimedIds.map((id) => releaseAssemblyClaim(client, id, owner))
    )
    throw err
  }
  dbTimeMs += Date.now() - fetchStartedAt

  if (pendingStories.length === 0) {
    return {
      storiesProcessed: 0,
      claimedStories: claimedIds.length,
      autoPublished: 0,
      sentToReview: 0,
      errors,
      dbTimeMs,
      modelTimeMs: 0,
      cheapModelTasks: 0,
      cheapModelFallbacks: 0,
      summaryFallbacks: 0,
    }
  }

  const claimedStories = pendingStories.length
  const concurrency = Math.max(
    1,
    Math.min(claimedStories, Math.floor(options?.concurrency ?? DEFAULT_STORY_ASSEMBLY_CONCURRENCY))
  )

  const batchResults = await mapWithConcurrency<PendingStory, StoryAssemblyBatchResult>(
    pendingStories,
    concurrency,
    async (story) => {
      try {
        const result = await assembleSingleStory(client, story.id, story.first_published, emitter)
        return { storyId: story.id, result }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const formattedMessage = `Story assembly failed for ${story.id}: ${message}`
        const failureStartedAt = Date.now()

        // Read current retry count so we can apply exponential backoff.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: current } = await (client.from('stories') as any)
          .select('assembly_retry_count')
          .eq('id', story.id)
          .single()
        const previousCount = (current?.assembly_retry_count as number | undefined) ?? 0
        const outcome = computeRetryOutcome('assemble', previousCount)

        // Transient (budget-remaining) failures stay in 'pending' so the
        // next pass picks them up after the backoff window — consistent
        // with embedding and clustering. Terminal (budget-exhausted)
        // failures go to 'failed' AND the DLQ for operator attention.
        const FAR_FUTURE = '2099-01-01T00:00:00Z'
        const nextAssemblyStatus = outcome.exhausted ? 'failed' : 'pending'
        const nextPublicationStatus = outcome.exhausted ? 'needs_review' : 'draft'

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client.from('stories') as any)
          .update({
            assembly_status: nextAssemblyStatus,
            publication_status: nextPublicationStatus,
            review_status: 'pending',
            review_reasons: outcome.exhausted ? ['assembly_failed'] : [],
            processing_error: message,
            assembly_claimed_at: null,
            assembly_claim_owner: null,
            assembly_retry_count: outcome.nextRetryCount,
            assembly_next_attempt_at: outcome.exhausted
              ? FAR_FUTURE
              : outcome.nextAttemptAt.toISOString(),
            assembly_last_error: message,
            last_updated: new Date().toISOString(),
          })
          .eq('id', story.id)
        await bumpAssemblyVersion(client, story.id)

        if (outcome.exhausted) {
          await pushToDeadLetter(client, {
            itemKind: 'story_assemble',
            itemId: story.id,
            retryCount: outcome.nextRetryCount,
            lastError: message,
          })
          await safeEmit(emitter, {
            stage: 'assemble',
            level: 'error',
            eventType: 'dlq_pushed',
            itemId: story.id,
            payload: {
              storyId: story.id,
              retryCount: outcome.nextRetryCount,
              error: message,
            },
          })
        }

        return { storyId: story.id, error: formattedMessage, failureDbTimeMs: Date.now() - failureStartedAt }
      }
    }
  )

  const tagPromises: Promise<void>[] = []

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

    if (batchResult.result.tagPromise) {
      tagPromises.push(batchResult.result.tagPromise)
    }

    if (batchResult.result.publicationStatus === 'published') {
      autoPublished += 1
    } else if (batchResult.result.publicationStatus === 'needs_review') {
      sentToReview += 1
    }
  }

  // Await all tag extractions at the end of the batch.
  // This ensures the serverless function (Vercel) doesn't terminate and kill
  // the promises before they complete, while still allowing the main story
  // assemblies and DB updates to proceed without blocking on tags.
  await Promise.all(tagPromises)

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
