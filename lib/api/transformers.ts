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
  StoryTag,
  AISummary,
  SpectrumSegment,
  FactualityLevel,
  OwnershipType,
  TagType,
  Topic,
  Region,
} from '@/lib/types'
import type { DbSource } from '@/lib/supabase/types'
import { getSourceSlug } from '@/lib/source-slugs'

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

export function transformSource(row: DbSource, articleUrl?: string): NewsSource {
  return {
    id: row.id,
    slug: getSourceSlug(row),
    name: row.name,
    bias: row.bias,
    factuality: row.factuality,
    ownership: row.ownership,
    region: row.region as Region,
    url: row.url ?? undefined,
    ...(articleUrl ? { articleUrl } : {}),
    totalArticlesIngested: row.total_articles_ingested,
  }
}

interface TagRow {
  slug: string
  label: string
  tag_type: string
  story_count: number
  description?: string | null
  relevance?: number
}

export function transformTag(row: TagRow): StoryTag {
  return {
    slug: row.slug,
    label: row.label,
    type: row.tag_type as TagType,
    relevance: row.relevance ?? 1,
    storyCount: row.story_count,
    ...(row.description ? { description: row.description } : {}),
  }
}

export function transformStory(
  story: StoryWithSources,
  sources: readonly DbSource[],
  articleUrlMap?: Map<string, string>,
  tags?: readonly TagRow[]
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
    sources: sources.map((s) => transformSource(s, articleUrlMap?.get(s.id))),
    spectrumSegments: parseSpectrumSegments(story.spectrum_segments),
    aiSummary: parseAISummary(story.ai_summary),
    timestamp: story.first_published,
    region: story.region as Region,
    ...(tags && tags.length > 0 ? { tags: tags.map(transformTag) } : {}),
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
