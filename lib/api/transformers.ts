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
  MediaOwner,
  StoryTag,
  AISummary,
  SpectrumSegment,
  FactualityLevel,
  OwnershipType,
  OwnerType,
  TagType,
  Topic,
  Region,
  BiasCategory,
  StoryVelocity,
  StorySentiment,
  KeyQuote,
  KeyClaim,
  HeadlineComparison,
} from '@/lib/types'
import type { DbSource, DbMediaOwner } from '@/lib/supabase/types'
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
  published_at: string
  first_published: string
  last_updated: string
  story_velocity?: unknown
  impact_score?: number | null
  source_diversity?: number | null
  controversy_score?: number | null
  sentiment?: unknown
  key_quotes?: unknown
  key_claims?: unknown
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

const VALID_SENTIMENTS = new Set(['angry', 'fearful', 'hopeful', 'neutral', 'critical', 'celebratory'])
const VALID_PHASES = new Set(['breaking', 'developing', 'analysis', 'aftermath'])

function parseStoryVelocity(raw: unknown): StoryVelocity | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (
    typeof obj.articles_24h !== 'number' ||
    typeof obj.articles_48h !== 'number' ||
    typeof obj.articles_7d !== 'number' ||
    !VALID_PHASES.has(String(obj.phase))
  ) {
    return null
  }
  return {
    articles_24h: obj.articles_24h,
    articles_48h: obj.articles_48h,
    articles_7d: obj.articles_7d,
    phase: obj.phase as StoryVelocity['phase'],
  }
}

function parseSentiment(raw: unknown): StorySentiment | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (!VALID_SENTIMENTS.has(String(obj.left)) || !VALID_SENTIMENTS.has(String(obj.right))) {
    return null
  }
  return {
    left: obj.left as StorySentiment['left'],
    right: obj.right as StorySentiment['right'],
  }
}

function parseKeyQuotes(raw: unknown): KeyQuote[] | null {
  if (!Array.isArray(raw)) return null
  return raw
    .filter(
      (q): q is { text: string; sourceName: string; sourceBias: string } =>
        typeof q === 'object' &&
        q !== null &&
        typeof q.text === 'string' &&
        typeof q.sourceName === 'string' &&
        typeof q.sourceBias === 'string'
    )
    .map((q) => ({ text: q.text, sourceName: q.sourceName, sourceBias: q.sourceBias }))
}

function parseKeyClaims(raw: unknown): KeyClaim[] | null {
  if (!Array.isArray(raw)) return null
  return raw
    .filter(
      (c): c is { claim: string; side: string; disputed: boolean; counterClaim?: string } =>
        typeof c === 'object' &&
        c !== null &&
        typeof c.claim === 'string' &&
        typeof c.side === 'string' &&
        typeof c.disputed === 'boolean'
    )
    .map((c) => ({
      claim: c.claim,
      side: c.side as KeyClaim['side'],
      disputed: c.disputed,
      ...(c.counterClaim ? { counterClaim: c.counterClaim } : {}),
    }))
}

export function transformHeadlines(
  rows: ReadonlyArray<{ title: string; sourceName: string; sourceBias: string }>
): HeadlineComparison[] {
  return rows.map((row) => ({
    title: row.title,
    sourceName: row.sourceName,
    sourceBias: row.sourceBias as BiasCategory,
  }))
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

export function transformOwner(row: DbMediaOwner & { source_count?: number }): MediaOwner {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerType: row.owner_type as OwnerType,
    isIndividual: row.is_individual,
    country: row.country,
    wikidataQid: row.wikidata_qid,
    ownerSource: row.owner_source as MediaOwner['ownerSource'],
    ownerVerifiedAt: row.owner_verified_at,
    ...(row.source_count !== undefined ? { sourceCount: row.source_count } : {}),
  }
}

export function transformSource(row: DbSource, articleUrl?: string, owner?: DbMediaOwner): NewsSource {
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
    ...(owner ? { owner: transformOwner(owner) } : {}),
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

/** Minimal owner shape needed for transform — matches the SELECT in querySourcesForStory. */
export interface OwnerTransformInput {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly owner_type: string
  readonly is_individual: boolean
  readonly country: string | null
  readonly wikidata_qid: string | null
  readonly owner_source: string
  readonly owner_verified_at: string
}

export function transformStory(
  story: StoryWithSources,
  sources: readonly DbSource[],
  articleUrlMap?: Map<string, string>,
  tags?: readonly TagRow[],
  headlines?: ReadonlyArray<{ title: string; sourceName: string; sourceBias: string }>,
  ownerMap?: Map<string, OwnerTransformInput>,
  ownershipUnavailable?: boolean
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
    sources: sources.map((s) => {
      const owner = s.owner_id && ownerMap ? ownerMap.get(s.owner_id) : undefined
      return transformSource(s, articleUrlMap?.get(s.id), owner as DbMediaOwner | undefined)
    }),
    spectrumSegments: parseSpectrumSegments(story.spectrum_segments),
    aiSummary: parseAISummary(story.ai_summary),
    timestamp: story.published_at,
    region: story.region as Region,
    ...(tags && tags.length > 0 ? { tags: tags.map(transformTag) } : {}),
    storyVelocity: parseStoryVelocity(story.story_velocity),
    impactScore: story.impact_score ?? null,
    sourceDiversity: story.source_diversity ?? null,
    controversyScore: story.controversy_score ?? null,
    sentiment: parseSentiment(story.sentiment),
    keyQuotes: parseKeyQuotes(story.key_quotes),
    keyClaims: parseKeyClaims(story.key_claims),
    ...(headlines && headlines.length > 0 ? { headlines: transformHeadlines(headlines) } : {}),
    ...(ownershipUnavailable ? { ownershipUnavailable: true } : {}),
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
    timestamp: story.published_at,
    region: story.region as Region,
    storyVelocity: parseStoryVelocity(story.story_velocity),
    impactScore: story.impact_score ?? null,
    sourceDiversity: story.source_diversity ?? null,
    controversyScore: story.controversy_score ?? null,
    sentiment: parseSentiment(story.sentiment),
    keyQuotes: parseKeyQuotes(story.key_quotes),
    keyClaims: parseKeyClaims(story.key_claims),
  }
}
