/**
 * lib/api/transformers.ts — DB row → frontend type transformers.
 *
 * Converts Supabase database rows into the NewsArticle and NewsSource
 * interfaces expected by the frontend components. Zero component changes
 * needed when switching from static sample data to live API data.
 */

import type {
  NewsArticle,
  NewsSource,
  AISummary,
  SpectrumSegment,
  FactualityLevel,
  OwnershipType,
  Topic,
  Region,
} from '@/lib/types'
import type { DbSource } from '@/lib/supabase/types'

interface StoryWithSources {
  id: string
  headline: string
  topic: string
  region: string
  source_count: number
  is_blindspot: boolean
  image_url: string | null
  factuality: string
  ownership: string
  spectrum_segments: unknown
  ai_summary: unknown
  first_published: string
  last_updated: string
}

const DEFAULT_AI_SUMMARY: AISummary = {
  commonGround: 'Summary not yet generated.',
  leftFraming: 'Summary not yet generated.',
  rightFraming: 'Summary not yet generated.',
}

function parseAISummary(raw: unknown): AISummary {
  if (
    raw !== null &&
    typeof raw === 'object' &&
    'commonGround' in raw &&
    'leftFraming' in raw &&
    'rightFraming' in raw
  ) {
    const obj = raw as Record<string, unknown>
    return {
      commonGround: String(obj.commonGround ?? ''),
      leftFraming: String(obj.leftFraming ?? ''),
      rightFraming: String(obj.rightFraming ?? ''),
    }
  }
  return DEFAULT_AI_SUMMARY
}

function parseSpectrumSegments(raw: unknown): SpectrumSegment[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (s): s is { bias: string; percentage: number } =>
        typeof s === 'object' &&
        s !== null &&
        'bias' in s &&
        'percentage' in s
    )
    .map((s) => ({
      bias: s.bias as SpectrumSegment['bias'],
      percentage: Number(s.percentage),
    }))
}

export function transformSource(row: DbSource): NewsSource {
  return {
    id: row.id,
    name: row.name,
    bias: row.bias,
    factuality: row.factuality,
    ownership: row.ownership,
    url: row.url ?? undefined,
  }
}

export function transformStory(
  story: StoryWithSources,
  sources: readonly DbSource[]
): NewsArticle {
  return {
    id: story.id,
    headline: story.headline,
    topic: story.topic as Topic,
    sourceCount: story.source_count,
    isBlindspot: story.is_blindspot,
    imageUrl: story.image_url ?? null,
    factuality: story.factuality as FactualityLevel,
    ownership: story.ownership as OwnershipType,
    sources: sources.map(transformSource),
    spectrumSegments: parseSpectrumSegments(story.spectrum_segments),
    aiSummary: parseAISummary(story.ai_summary),
    timestamp: story.first_published,
    region: story.region as Region,
  }
}

export function transformStoryList(
  story: StoryWithSources
): Omit<NewsArticle, 'sources'> & { sources: NewsSource[] } {
  return {
    id: story.id,
    headline: story.headline,
    topic: story.topic as Topic,
    sourceCount: story.source_count,
    isBlindspot: story.is_blindspot,
    imageUrl: story.image_url ?? null,
    factuality: story.factuality as FactualityLevel,
    ownership: story.ownership as OwnershipType,
    sources: [],
    spectrumSegments: parseSpectrumSegments(story.spectrum_segments),
    aiSummary: parseAISummary(story.ai_summary),
    timestamp: story.first_published,
    region: story.region as Region,
  }
}
