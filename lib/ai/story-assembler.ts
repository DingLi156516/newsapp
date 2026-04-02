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
import { generateAISummary } from '@/lib/ai/summary-generator'
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
}

export interface AssembleStoriesOptions {
  readonly concurrency?: number
}

interface StoryAssemblyBatchResult {
  readonly storyId: string
  readonly result?: Awaited<ReturnType<typeof assembleSingleStory>>
  readonly error?: string
}

interface PendingStory {
  id: string
  assembly_claimed_at: string | null
}

const CLAIM_SCAN_MULTIPLIER = 3
const DEFAULT_STORY_ASSEMBLY_CONCURRENCY = 3

function dominantValue<T extends string>(values: readonly T[], fallback: T): T {
  if (values.length === 0) return fallback

  const counts = new Map<T, number>()
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1)
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

export async function assembleSingleStory(
  client: SupabaseClient<Database>,
  storyId: string
): Promise<{ publicationStatus: 'published' | 'needs_review' | 'draft' | 'rejected' }> {
  const { data: articles, error: articlesError } = await client
    .from('articles')
    .select('id, title, description, source_id, image_url')
    .eq('story_id', storyId)
    .order('published_at', { ascending: false })
    .order('id', { ascending: true })
    .returns<StoryArticle[]>()

  if (articlesError) {
    throw new Error(`Failed to fetch articles for story ${storyId}: ${articlesError.message}`)
  }

  if (!articles || articles.length === 0) {
    throw new Error(`No articles found for story ${storyId}`)
  }

  const sourceIds = [...new Set(articles.map((a) => a.source_id))]
  const { data: sources, error: sourcesError } = await client
    .from('sources')
    .select('id, bias, factuality, ownership')
    .in('id', sourceIds)
    .returns<Array<Pick<DbSource, 'id' | 'bias' | 'factuality' | 'ownership'>>>()

  if (sourcesError) {
    throw new Error(`Failed to fetch sources for story ${storyId}: ${sourcesError.message}`)
  }

  const sourceMap = new Map(
    (sources ?? []).map((s) => [s.id, s])
  )

  const titles = articles.map((a) => a.title)
  const biases = articles
    .map((a) => sourceMap.get(a.source_id)?.bias)
    .filter((b): b is BiasCategory => b !== undefined)

  const descriptions = articles.map((a) => a.description)

  const entitiesPromise = extractEntities(titles, descriptions)

  const [headline, topic, region, aiSummary] = await Promise.all([
    generateNeutralHeadline(titles),
    classifyTopic(titles),
    classifyRegion(titles),
    generateAISummary(
      articles.map((a) => ({
        title: a.title,
        description: a.description,
        bias: sourceMap.get(a.source_id)?.bias ?? 'center',
      }))
    ),
  ])

  const spectrumSegments = calculateSpectrum(biases)
  const blindspot = isBlindspot(spectrumSegments)

  const factualities = (sources ?? []).map((s) => s.factuality)
  const ownerships = (sources ?? []).map((s) => s.ownership)

  const imageUrl = articles.find((a) => a.image_url)?.image_url ?? null
  const publicationDecision = decideStoryPublication({
    articleCount: articles.length,
    sourceCount: sourceIds.length,
    isBlindspot: blindspot,
    factuality: dominantValue<FactualityLevel>(factualities, 'mixed'),
    aiSummary,
    processingError: null,
  })
  const now = new Date().toISOString()

  // Write entity tags before publishing — errors swallowed, never block publication
  try {
    const entities = await entitiesPromise
    await upsertStoryTags(client, storyId, entities)
  } catch (tagErr) {
    console.error(`[story-assembler] Entity tagging failed for ${storyId}:`, tagErr instanceof Error ? tagErr.message : String(tagErr))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (client.from('stories') as any)
    .update({
      headline,
      story_kind: 'standard',
      topic,
      region,
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

  if (updateError) {
    throw new Error(`Failed to update story ${storyId}: ${updateError.message}`)
  }

  return { publicationStatus: publicationDecision.publicationStatus }
}

export async function assembleStories(
  client: SupabaseClient<Database>,
  maxStories = 50,
  options?: AssembleStoriesOptions
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
    return { storiesProcessed: 0, claimedStories: 0, autoPublished: 0, sentToReview: 0, errors: [] }
  }

  const pendingStories = fetchedStories
    .filter((story) => isClaimAvailable(story.assembly_claimed_at, ASSEMBLY_CLAIM_TTL_MS))
    .slice(0, maxStories)

  if (pendingStories.length === 0) {
    return { storiesProcessed: 0, claimedStories: 0, autoPublished: 0, sentToReview: 0, errors: [] }
  }

  const errors: string[] = []
  const claimedStories = pendingStories.length
  const claimedAt = new Date().toISOString()
  const concurrency = Math.max(
    1,
    Math.min(
      claimedStories,
      Math.floor(options?.concurrency ?? DEFAULT_STORY_ASSEMBLY_CONCURRENCY)
    )
  )

  for (const story of pendingStories) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from('stories') as any)
      .update({
        assembly_status: 'processing',
        assembly_claimed_at: claimedAt,
      })
      .eq('id', story.id)
  }

  let storiesProcessed = 0
  let autoPublished = 0
  let sentToReview = 0

  for (let i = 0; i < pendingStories.length; i += concurrency) {
    const storyBatch = pendingStories.slice(i, i + concurrency)
    const batchResults: StoryAssemblyBatchResult[] = await Promise.all(
      storyBatch.map(async (story) => {
        try {
          const result = await assembleSingleStory(client, story.id)
          return { storyId: story.id, result }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          const formattedMessage = `Story assembly failed for ${story.id}: ${message}`
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
          return { storyId: story.id, error: formattedMessage }
        }
      })
    )

    for (const batchResult of batchResults) {
      if (batchResult.error) {
        errors.push(batchResult.error)
        continue
      }

      if (!batchResult.result) {
        continue
      }

      storiesProcessed++
      if (batchResult.result.publicationStatus === 'published') {
        autoPublished++
      } else if (batchResult.result.publicationStatus === 'needs_review') {
        sentToReview++
      }
    }
  }

  return { storiesProcessed, claimedStories, autoPublished, sentToReview, errors }
}
