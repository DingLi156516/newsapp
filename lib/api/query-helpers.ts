/**
 * lib/api/query-helpers.ts — Supabase query builder helpers.
 *
 * Builds filtered, paginated Supabase queries from validated query params.
 * Each helper returns a modified query builder — no side effects.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { StoriesQuery, SourcesQuery } from '@/lib/api/validation'
import type { FactualityLevel, DatePreset } from '@/lib/types'
import { ALL_BIASES, FACTUALITY_RANK } from '@/lib/types'

interface StoryRow {
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

interface SourceRow {
  id: string
  slug: string
  name: string
  bias: string
  factuality: string
  ownership: string
  url: string | null
  rss_url: string | null
  region: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function queryStories(
  client: SupabaseClient<Database>,
  params: StoriesQuery
): Promise<{ data: StoryRow[]; count: number }> {
  const {
    topic,
    search,
    blindspot,
    biasRange,
    minFactuality,
    datePreset,
    page,
    limit,
  } = params

  const offset = (page - 1) * limit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client.from('stories') as any)
    .select(
      'id, headline, topic, region, source_count, is_blindspot, image_url, factuality, ownership, spectrum_segments, ai_summary, first_published, last_updated',
      { count: 'exact' }
    )
    .neq('headline', 'Pending headline generation')
    .eq('review_status', 'approved')

  if (topic) {
    query = query.eq('topic', topic)
  }

  if (blindspot === 'true') {
    query = query.eq('is_blindspot', true)
  }

  if (search) {
    query = query.textSearch('search_vector', search, { type: 'websearch' })
  }

  if (minFactuality) {
    const allowed = getFactualitiesAtOrAbove(minFactuality as FactualityLevel)
    query = query.in('factuality', allowed)
  }

  if (datePreset && datePreset !== 'all') {
    query = query.gte('first_published', getDateThreshold(datePreset as Exclude<DatePreset, 'all'>))
  }

  query = query
    .order('last_updated', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    throw new Error(`Failed to query stories: ${error.message}`)
  }

  let filteredStories = data ?? []

  if (biasRange) {
    const biases = biasRange.split(',').filter(b => (ALL_BIASES as readonly string[]).includes(b))
    if (biases.length > 0 && biases.length < 7) {
      filteredStories = filteredStories.filter((story: StoryRow) => {
        const segments = story.spectrum_segments
        if (!Array.isArray(segments)) return true
        return segments.some((s: { bias: string }) => biases.includes(s.bias))
      })
    }
  }

  return { data: filteredStories, count: count ?? 0 }
}

export function getFactualitiesAtOrAbove(min: FactualityLevel): string[] {
  const minRank = FACTUALITY_RANK[min]
  return Object.entries(FACTUALITY_RANK)
    .filter(([, rank]) => rank >= minRank)
    .map(([level]) => level)
}

export function getDateThreshold(preset: Exclude<DatePreset, 'all'>): string {
  const hours: Record<Exclude<DatePreset, 'all'>, number> = {
    '24h': 24,
    '7d': 7 * 24,
    '30d': 30 * 24,
  }
  return new Date(Date.now() - hours[preset] * 3_600_000).toISOString()
}

export async function queryStoryById(
  client: SupabaseClient<Database>,
  storyId: string
): Promise<StoryRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('stories') as any)
    .select(
      'id, headline, topic, region, source_count, is_blindspot, image_url, factuality, ownership, spectrum_segments, ai_summary, first_published, last_updated'
    )
    .eq('id', storyId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch story: ${error.message}`)
  }

  return data
}

interface ArticleSourceJoin {
  source_id: string
}

export async function querySourcesForStory(
  client: SupabaseClient<Database>,
  storyId: string
): Promise<SourceRow[]> {
  // First get source IDs from articles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: articles, error: articleError } = await (client.from('articles') as any)
    .select('source_id')
    .eq('story_id', storyId)

  if (articleError) {
    throw new Error(`Failed to fetch articles: ${articleError.message}`)
  }

  if (!articles || articles.length === 0) return []

  const sourceIds = [...new Set(articles.map((a: ArticleSourceJoin) => a.source_id))]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sources, error: sourceError } = await (client.from('sources') as any)
    .select('id, slug, name, bias, factuality, ownership, url, rss_url, region, is_active, created_at, updated_at')
    .in('id', sourceIds)

  if (sourceError) {
    throw new Error(`Failed to fetch sources: ${sourceError.message}`)
  }

  return sources ?? []
}

// ---------------------------------------------------------------------------
// Timeline: articles with source metadata for a story
// ---------------------------------------------------------------------------

export interface ArticleWithSource {
  readonly id: string
  readonly title: string
  readonly published_at: string
  readonly source_id: string
  readonly source_name: string
  readonly source_bias: string
  readonly source_factuality: string
}

interface ArticleSourceJoinRow {
  id: string
  title: string
  published_at: string | null
  source_id: string
  sources: { name: string; bias: string; factuality: string } | null
}

export async function queryArticlesWithSourcesForStory(
  client: SupabaseClient<Database>,
  storyId: string
): Promise<ArticleWithSource[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('articles') as any)
    .select('id, title, published_at, source_id, sources!articles_source_id_fkey(name, bias, factuality)')
    .eq('story_id', storyId)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch articles for timeline: ${error.message}`)
  }

  if (!data || data.length === 0) return []

  return (data as ArticleSourceJoinRow[])
    .filter((row) => row.sources !== null && row.published_at !== null)
    .map((row) => ({
      id: row.id,
      title: row.title,
      published_at: row.published_at!,
      source_id: row.source_id,
      source_name: row.sources!.name,
      source_bias: row.sources!.bias,
      source_factuality: row.sources!.factuality,
    }))
}

export async function querySources(
  client: SupabaseClient<Database>,
  params: SourcesQuery
): Promise<{ data: SourceRow[]; count: number }> {
  const { bias, factuality, ownership, region, search, page, limit } = params
  const offset = (page - 1) * limit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client.from('sources') as any)
    .select(
      'id, slug, name, bias, factuality, ownership, url, rss_url, region, is_active, created_at, updated_at',
      { count: 'exact' }
    )
    .eq('is_active', true)

  if (bias) {
    query = query.eq('bias', bias)
  }

  if (factuality) {
    query = query.eq('factuality', factuality)
  }

  if (ownership) {
    query = query.eq('ownership', ownership)
  }

  if (region) {
    query = query.eq('region', region)
  }

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  query = query
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    throw new Error(`Failed to query sources: ${error.message}`)
  }

  return { data: data ?? [], count: count ?? 0 }
}
