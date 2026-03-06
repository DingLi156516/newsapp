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
import { calculateSpectrum } from '@/lib/ai/spectrum-calculator'
import { isBlindspot } from '@/lib/ai/blindspot-detector'

interface StoryArticle {
  id: string
  title: string
  description: string | null
  source_id: string
  image_url: string | null
}

export interface AssemblyResult {
  readonly storiesProcessed: number
  readonly errors: readonly string[]
}

interface PendingStory {
  id: string
}

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

export async function assembleStories(
  client: SupabaseClient<Database>
): Promise<AssemblyResult> {
  const { data: pendingStories, error: fetchError } = await client
    .from('stories')
    .select('id')
    .eq('headline', 'Pending headline generation')
    .returns<PendingStory[]>()

  if (fetchError) {
    throw new Error(`Failed to fetch pending stories: ${fetchError.message}`)
  }

  if (!pendingStories || pendingStories.length === 0) {
    return { storiesProcessed: 0, errors: [] }
  }

  const errors: string[] = []
  let storiesProcessed = 0

  for (const story of pendingStories) {
    try {
      const { data: articles, error: articlesError } = await client
        .from('articles')
        .select('id, title, description, source_id, image_url')
        .eq('story_id', story.id)
        .returns<StoryArticle[]>()

      if (articlesError || !articles || articles.length === 0) {
        errors.push(`No articles for story ${story.id}`)
        continue
      }

      const sourceIds = [...new Set(articles.map((a) => a.source_id))]
      const { data: sources, error: sourcesError } = await client
        .from('sources')
        .select('id, bias, factuality, ownership')
        .in('id', sourceIds)
        .returns<Array<Pick<DbSource, 'id' | 'bias' | 'factuality' | 'ownership'>>>()

      if (sourcesError) {
        errors.push(`Failed to fetch sources for story ${story.id}: ${sourcesError.message}`)
        continue
      }

      const sourceMap = new Map(
        (sources ?? []).map((s) => [s.id, s])
      )

      const titles = articles.map((a) => a.title)
      const biases = articles
        .map((a) => sourceMap.get(a.source_id)?.bias)
        .filter((b): b is BiasCategory => b !== undefined)

      const [headline, topic, aiSummary] = await Promise.all([
        generateNeutralHeadline(titles),
        classifyTopic(titles),
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (client.from('stories') as any)
        .update({
          headline,
          topic,
          source_count: articles.length,
          is_blindspot: blindspot,
          image_url: imageUrl,
          factuality: dominantValue<FactualityLevel>(factualities, 'mixed'),
          ownership: dominantValue<OwnershipType>(ownerships, 'other'),
          spectrum_segments: spectrumSegments,
          ai_summary: aiSummary,
          last_updated: new Date().toISOString(),
        })
        .eq('id', story.id)

      if (updateError) {
        errors.push(`Failed to update story ${story.id}: ${updateError.message}`)
      } else {
        storiesProcessed++
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Story assembly failed for ${story.id}: ${message}`)
    }
  }

  return { storiesProcessed, errors }
}
