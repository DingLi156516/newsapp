/**
 * lib/api/query-helpers.ts — Supabase query builder helpers.
 *
 * Builds filtered, paginated Supabase queries from validated query params.
 * Each helper returns a modified query builder — no side effects.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { StoriesQuery, SourcesQuery, TagsQuery } from '@/lib/api/validation'
import type { FactualityLevel, DatePreset, Topic, Region } from '@/lib/types'
import { ALL_BIASES, FACTUALITY_RANK } from '@/lib/types'
import { getSourceSlug, normalizeSourceSlug } from '@/lib/source-slugs'

/**
 * Recency window for the trending feed — candidates older than this are
 * excluded from the SQL filter so stale stories can't resurface even if
 * their stored `trending_score` is high.
 */
export const TRENDING_WINDOW_HOURS = 7 * 24

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
  published_at: string
  first_published: string
  last_updated: string
  story_velocity: unknown
  impact_score: number | null
  source_diversity: number | null
  controversy_score: number | null
  trending_score: number | null
  sentiment: unknown
  key_quotes: unknown
  key_claims: unknown
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
  owner_id?: string | null
}

interface OwnerRow {
  id: string
  name: string
  slug: string
  owner_type: string
  is_individual: boolean
  country: string | null
  wikidata_qid: string | null
  owner_source: string
  owner_verified_at: string
}

interface SourceStoryJoinRow {
  url: string | null
  published_at: string | null
  stories: {
    id: string
    headline: string
    topic: string
    region: string
    is_blindspot: boolean
    first_published: string
    last_updated: string
  } | null
}

interface SourceProfileStoryRow {
  id: string
  headline: string
  topic: Topic
  region: Region
  timestamp: string
  isBlindspot: boolean
  articleUrl?: string
}

export async function queryStories(
  client: SupabaseClient<Database>,
  params: StoriesQuery
): Promise<{ data: StoryRow[]; count: number }> {
  const {
    topic,
    region,
    search,
    blindspot,
    biasRange,
    minFactuality,
    datePreset,
    sort,
    tag,
    tag_type,
    ids,
    page,
    limit,
  } = params

  const offset = (page - 1) * limit

  // Resolve tag slug → ID(s) before building the base query (needed for !inner join)
  let tagIds: readonly string[] = []
  if (tag) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tagQuery = (client.from('tags') as any)
      .select('id')
      .eq('slug', tag)

    if (tag_type) {
      tagQuery = tagQuery.eq('tag_type', tag_type)
    }

    const { data: tagRows, error: tagLookupError } = await tagQuery

    if (tagLookupError) {
      throw new Error(`Failed to look up tag "${tag}": ${tagLookupError.message}`)
    }
    if (!tagRows || tagRows.length === 0) return { data: [], count: 0 }
    tagIds = (tagRows as Array<{ id: string }>).map(r => r.id)
  }

  const hasTagFilter = tagIds.length > 0
  // `trending_score` is added only for sort=trending so non-trending queries
  // don't depend on migration 050 — protects Latest/Saved/Blindspot against
  // schema skew if the app is ever deployed ahead of the migration.
  const baseColumns = 'id, headline, topic, region, source_count, is_blindspot, image_url, factuality, ownership, spectrum_segments, ai_summary, published_at, first_published, last_updated, story_velocity, impact_score, source_diversity, controversy_score, sentiment, key_quotes, key_claims'
  const columnsWithSort = sort === 'trending' ? `${baseColumns}, trending_score` : baseColumns
  const selectStr = hasTagFilter ? `${columnsWithSort}, story_tags!inner(tag_id)` : columnsWithSort

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client.from('stories') as any)
    .select(selectStr, { count: 'exact' })
    .eq('publication_status', 'published')

  if (hasTagFilter) {
    query = tagIds.length === 1
      ? query.eq('story_tags.tag_id', tagIds[0])
      : query.in('story_tags.tag_id', [...tagIds])
  }

  if (ids) {
    const idList = ids.split(',').filter(Boolean)
    if (idList.length > 0) {
      query = query.in('id', idList)
    }
  }

  if (topic) {
    query = query.eq('topic', topic)
  }

  if (region) {
    query = query.eq('region', region)
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

  if (sort === 'trending') {
    // Trending uses the materialized `trending_score` column (migration 050).
    // Scores are populated by the refresh cron (`/api/cron/refresh-trending`)
    // and the migration's inline backfill. Newly-assembled stories with NULL
    // scores remain eligible and sort to the bottom via `NULLS LAST` — they
    // surface immediately in the feed, then move up when the next refresh
    // tick (≤15 min) scores them. No `IS NOT NULL` filter: it would create a
    // visible freshness gap that hides breaking news from Trending.
    //
    // biasRange is applied *in SQL* here (unlike other sorts which filter in
    // memory post-fetch). If we paginated before bias filtering the current
    // page could be entirely non-matching while valid stories sit outside it.
    const trendingWindowIso = new Date(
      Date.now() - TRENDING_WINDOW_HOURS * 3_600_000
    ).toISOString()
    query = query.gte('published_at', trendingWindowIso)

    if (biasRange) {
      const biases = biasRange
        .split(',')
        .filter((b) => (ALL_BIASES as readonly string[]).includes(b))
      if (biases.length > 0 && biases.length < 7) {
        // JSONB containment: `spectrum_segments @> '[{"bias":"left"}]'` is true
        // when at least one segment object has `bias: left` (and optionally
        // more keys). OR-joined across the selected biases mirrors the TS
        // `segments.some(s => biases.includes(s.bias))` post-filter exactly.
        const clauses = biases
          .map((b) => `spectrum_segments.cs.[{"bias":"${b}"}]`)
          .join(',')
        query = query.or(clauses)
      }
    }

    query = query
      .order('trending_score', { ascending: false, nullsFirst: false })
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)
  } else if (sort === 'source_count') {
    query = query
      .order('source_count', { ascending: false })
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)
  } else {
    query = query
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)
  }

  const { data, count, error } = await query

  if (error) {
    throw new Error(`Failed to query stories: ${error.message}`)
  }

  // Strip nested story_tags from response when tag filter was used
  let filteredStories = (data ?? []).map((story: StoryRow & { story_tags?: unknown }) => {
    if (!hasTagFilter) return story
    const { story_tags: _st, ...sanitizedStory } = story
    return sanitizedStory
  })

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

  filteredStories = filteredStories.sort((a: StoryRow, b: StoryRow) => {
    if (sort === 'trending') {
      const scoreDiff = (b.trending_score ?? 0) - (a.trending_score ?? 0)
      if (scoreDiff !== 0) return scoreDiff
    }
    if (sort === 'source_count') {
      const countDiff = b.source_count - a.source_count
      if (countDiff !== 0) return countDiff
    }
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  })

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
      // trending_score is a ranking signal, not surfaced on story detail,
      // so keep it out of this select to avoid coupling detail reads to migration 050.
      'id, headline, topic, region, source_count, is_blindspot, image_url, factuality, ownership, spectrum_segments, ai_summary, published_at, first_published, last_updated, story_velocity, impact_score, source_diversity, controversy_score, sentiment, key_quotes, key_claims'
    )
    .eq('id', storyId)
    .eq('publication_status', 'published')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch story: ${error.message}`)
  }

  return data
}

export async function querySourceBySlug(
  client: SupabaseClient<Database>,
  slug: string
): Promise<SourceRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('sources') as any)
    .select('id, slug, name, bias, factuality, ownership, url, rss_url, region, is_active, created_at, updated_at')
    .eq('slug', slug)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // Some older source rows may not have a persisted slug yet. Fall back to
      // deriving one from the source name so profile routes still work.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sources, error: listError } = await (client.from('sources') as any)
        .select('id, slug, name, bias, factuality, ownership, url, rss_url, region, is_active, created_at, updated_at')
        .eq('is_active', true)

      if (listError) {
        throw new Error(`Failed to fetch source: ${listError.message}`)
      }

      const matchedSource = (sources as SourceRow[] | null)?.find(
        (row) => normalizeSourceSlug(getSourceSlug(row)) === slug
      )

      return matchedSource ?? null
    }
    throw new Error(`Failed to fetch source: ${error.message}`)
  }

  return data
}

// ---------------------------------------------------------------------------
// Headline comparison: article titles with source bias for a story
// ---------------------------------------------------------------------------

interface HeadlineRow {
  title: string
  sources: { name: string; bias: string } | null
}

export async function queryHeadlinesForStory(
  client: SupabaseClient<Database>,
  storyId: string
): Promise<Array<{ title: string; sourceName: string; sourceBias: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('articles') as any)
    .select('title, sources!articles_source_id_fkey(name, bias)')
    .eq('story_id', storyId)
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch headlines for story: ${error.message}`)
  }

  if (!data || data.length === 0) return []

  const biasOrder: Record<string, number> = {
    'far-left': 0, 'left': 1, 'lean-left': 2, 'center': 3,
    'lean-right': 4, 'right': 5, 'far-right': 6,
  }

  return (data as HeadlineRow[])
    .filter((row) => row.sources !== null)
    .map((row) => ({
      title: row.title,
      sourceName: row.sources!.name,
      sourceBias: row.sources!.bias,
    }))
    .filter((item, index, arr) => arr.findIndex((h) => h.sourceName === item.sourceName) === index)
    .sort((a, b) => (biasOrder[a.sourceBias] ?? 3) - (biasOrder[b.sourceBias] ?? 3))
}

interface ArticleSourceJoin {
  source_id: string
  url: string
}

export async function querySourcesForStory(
  client: SupabaseClient<Database>,
  storyId: string
): Promise<{
  sources: SourceRow[]
  articleUrlMap: Map<string, string>
  ownerMap: Map<string, OwnerRow>
  /**
   * True when a non-empty set of owner_ids existed but the media_owners
   * fetch failed. The story still returns with sources, but the flag lets
   * the UI distinguish "no linked owners" from "ownership lookup broke"
   * and lets monitoring tell them apart.
   */
  ownershipUnavailable: boolean
}> {
  // Get source IDs and article URLs from articles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: articles, error: articleError } = await (client.from('articles') as any)
    .select('source_id, url')
    .eq('story_id', storyId)
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })

  if (articleError) {
    throw new Error(`Failed to fetch articles: ${articleError.message}`)
  }

  if (!articles || articles.length === 0) {
    return { sources: [], articleUrlMap: new Map(), ownerMap: new Map(), ownershipUnavailable: false }
  }

  // Build map of source_id → first article URL
  const articleUrlMap = new Map<string, string>()
  for (const a of articles as ArticleSourceJoin[]) {
    if (!articleUrlMap.has(a.source_id) && a.url) {
      articleUrlMap.set(a.source_id, a.url)
    }
  }

  const sourceIds = [...new Set((articles as ArticleSourceJoin[]).map((a) => a.source_id))]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sources, error: sourceError } = await (client.from('sources') as any)
    .select('id, slug, name, bias, factuality, ownership, url, rss_url, region, is_active, created_at, updated_at, owner_id')
    .in('id', sourceIds)

  if (sourceError) {
    throw new Error(`Failed to fetch sources: ${sourceError.message}`)
  }

  const sourceRows = (sources ?? []) as SourceRow[]

  // Batch-fetch owners for non-null owner_ids
  const ownerMap = new Map<string, OwnerRow>()
  const ownerIds = [...new Set(sourceRows.map((s) => s.owner_id).filter((id): id is string => id != null))]

  if (ownerIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: owners, error: ownerError } = await (client.from('media_owners') as any)
      .select('id, name, slug, owner_type, is_individual, country, wikidata_qid, owner_source, owner_verified_at')
      .in('id', ownerIds)

    if (ownerError) {
      // Story data is fully valid without ownership — degrade gracefully so
      // a transient media_owners issue doesn't 500 the primary read path.
      // Log + return the flag so monitoring can tell this apart from stories
      // that legitimately have no linked owners.
      console.error(
        `[querySourcesForStory] media_owners lookup failed for story ${storyId}:`,
        ownerError.message
      )
      return { sources: sourceRows, articleUrlMap, ownerMap, ownershipUnavailable: true }
    }
    if (owners) {
      for (const o of owners as OwnerRow[]) {
        ownerMap.set(o.id, o)
      }
    }

    // Silent-partial detection: if any source claims an owner_id but the
    // fetched row is missing (RLS policy filtered it, soft-deleted row, etc.),
    // flag as unavailable. Otherwise a policy regression looks identical to
    // "no known owners" and the Phase 2 trust signal silently disappears.
    const fetchedOwnerIds = new Set<string>()
    for (const id of ownerMap.keys()) fetchedOwnerIds.add(id)
    const missing = ownerIds.filter((id) => !fetchedOwnerIds.has(id))
    if (missing.length > 0) {
      console.error(
        `[querySourcesForStory] media_owners returned ${ownerMap.size}/${ownerIds.length} rows for story ${storyId} — missing ${missing.length}:`,
        missing.slice(0, 5).join(', ')
      )
      return { sources: sourceRows, articleUrlMap, ownerMap, ownershipUnavailable: true }
    }
  }

  return { sources: sourceRows, articleUrlMap, ownerMap, ownershipUnavailable: false }
}

export async function queryRecentStoriesForSource(
  client: SupabaseClient<Database>,
  sourceId: string,
  sinceIso: string
): Promise<SourceProfileStoryRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('articles') as any)
    .select(`
      url,
      published_at,
      stories!articles_story_id_fkey(
        id,
        headline,
        topic,
        region,
        is_blindspot,
        first_published,
        last_updated
      )
    `)
    .eq('source_id', sourceId)
    .gte('published_at', sinceIso)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch recent stories for source: ${error.message}`)
  }

  if (!data || data.length === 0) return []

  const storiesById = new Map<string, SourceProfileStoryRow>()
  for (const row of data as SourceStoryJoinRow[]) {
    if (!row.stories || !row.published_at || storiesById.has(row.stories.id)) continue

    storiesById.set(row.stories.id, {
      id: row.stories.id,
      headline: row.stories.headline,
      topic: row.stories.topic as Topic,
      region: row.stories.region as Region,
      timestamp: row.stories.last_updated ?? row.stories.first_published ?? row.published_at,
      isBlindspot: row.stories.is_blindspot,
      ...(row.url ? { articleUrl: row.url } : {}),
    })
  }

  return [...storiesById.values()]
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
    .order('id', { ascending: true })

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

export interface SourceRowWithOwner extends SourceRow {
  total_articles_ingested?: number
  owner?: OwnerRow | null
}

export async function querySources(
  client: SupabaseClient<Database>,
  params: SourcesQuery
): Promise<{ data: SourceRowWithOwner[]; count: number; ownershipUnavailable: boolean }> {
  const { bias, factuality, ownership, region, search, page, limit } = params
  const offset = (page - 1) * limit

  // Three tiered selects, attempted in order:
  //   1. full        — base + owner_id + owner:media_owners embed
  //   2. with-fk     — base + owner_id (embed dropped)
  //   3. bare        — base only (no owner_id, no embed)
  //
  // Migration 048 (on `main`) adds both `sources.owner_id` and
  // `media_owners`, so tier 1 is the expected happy path. Tiers 2 and 3
  // exist to guarantee that a code deploy landing before the schema
  // migration — or an RLS/permission regression on either column — still
  // returns a working source directory rather than 500'ing the route.
  const preBase =
    'id, slug, name, bias, factuality, ownership, url, rss_url, region, is_active, created_at, updated_at, total_articles_ingested'
  const withFk = `${preBase}, owner_id`
  const withOwnerEmbed = `${withFk}, owner:media_owners(id, name, slug, owner_type, is_individual, country, wikidata_qid, owner_source, owner_verified_at)`

  const runQuery = async (selectCols: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (client.from('sources') as any)
      .select(selectCols, { count: 'exact' })
      .eq('is_active', true)
    if (bias) q = q.eq('bias', bias)
    if (factuality) q = q.eq('factuality', factuality)
    if (ownership) q = q.eq('ownership', ownership)
    if (region) q = q.eq('region', region)
    if (search) q = q.ilike('name', `%${search}%`)
    return q.order('name', { ascending: true }).range(offset, offset + limit - 1)
  }

  const first = await runQuery(withOwnerEmbed)
  if (!first.error) {
    // Silent-partial detection: a row with owner_id populated but
    // owner === null means PostgREST embed fetched fewer owner rows than
    // expected (RLS policy, missing FK target, etc.) without raising an
    // error. Treat as degraded so UI can relabel instead of showing real
    // owners as "unaffiliated".
    const rows = (first.data ?? []) as SourceRowWithOwner[]
    const partialMiss = rows.some((r) => r.owner_id && !r.owner)
    if (partialMiss) {
      const missCount = rows.filter((r) => r.owner_id && !r.owner).length
      console.error(
        `[querySources] media_owners embed returned ${missCount} rows with owner_id but null owner (silent RLS/FK miss)`
      )
    }
    return {
      data: rows,
      count: first.count ?? 0,
      ownershipUnavailable: partialMiss,
    }
  }

  console.error(
    '[querySources] media_owners join failed, retrying with owner_id only:',
    first.error.message
  )

  const second = await runQuery(withFk)
  if (!second.error) {
    return {
      data: (second.data ?? []) as SourceRowWithOwner[],
      count: second.count ?? 0,
      ownershipUnavailable: true,
    }
  }

  console.error(
    '[querySources] owner_id select failed, retrying source-only (pre-migration-048 schema):',
    second.error.message
  )

  const third = await runQuery(preBase)
  if (third.error) {
    throw new Error(`Failed to query sources: ${third.error.message}`)
  }

  return {
    data: (third.data ?? []) as SourceRowWithOwner[],
    count: third.count ?? 0,
    ownershipUnavailable: true,
  }
}

// ---------------------------------------------------------------------------
// Promoted tag constants
// ---------------------------------------------------------------------------

/** Minimum story_count for a tag to appear in feed navigation. */
export const PROMOTED_TAG_THRESHOLD = 3

/** Maximum number of promoted tags to display. */
export const PROMOTED_TAG_LIMIT = 15

// ---------------------------------------------------------------------------
// Tag queries
// ---------------------------------------------------------------------------

interface TagRow {
  id: string
  slug: string
  label: string
  description: string | null
  tag_type: string
  story_count: number
  created_at: string
}

export async function queryTags(
  client: SupabaseClient<Database>,
  params: TagsQuery
): Promise<{ data: TagRow[]; count: number }> {
  const { type, search, page, limit } = params
  const offset = (page - 1) * limit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client.from('tags') as any)
    .select('id, slug, label, description, tag_type, story_count, created_at', { count: 'exact' })

  if (type) {
    query = query.eq('tag_type', type)
  }

  if (search) {
    query = query.ilike('label', `%${search}%`)
  }

  query = query
    .order('story_count', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    throw new Error(`Failed to query tags: ${error.message}`)
  }

  return { data: data ?? [], count: count ?? 0 }
}

export async function queryTagBySlug(
  client: SupabaseClient<Database>,
  slug: string,
  tagType?: string
): Promise<TagRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client.from('tags') as any)
    .select('id, slug, label, description, tag_type, story_count, created_at')
    .eq('slug', slug)

  if (tagType) {
    query = query.eq('tag_type', tagType).limit(1)
  } else {
    query = query.order('story_count', { ascending: false })
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch tag: ${error.message}`)
  }

  return (data as TagRow[]) ?? []
}

export async function queryTagsForStory(
  client: SupabaseClient<Database>,
  storyId: string
): Promise<TagRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('story_tags') as any)
    .select('relevance, tags!story_tags_tag_id_fkey(id, slug, label, description, tag_type, story_count, created_at)')
    .eq('story_id', storyId)
    .order('relevance', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch tags for story: ${error.message}`)
  }

  if (!data || data.length === 0) return []

  return (data as Array<{ relevance: number; tags: TagRow | null }>)
    .filter((row) => row.tags !== null)
    .map((row) => ({
      ...row.tags!,
      relevance: row.relevance,
    }))
}

export async function queryRelatedTags(
  client: SupabaseClient<Database>,
  tagId: string,
  limitCount = 15
): Promise<TagRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc('related_tags_by_co_occurrence', {
    p_tag_id: tagId,
    p_limit: limitCount,
  })

  if (error) {
    throw new Error(`Failed to fetch related tags: ${error.message}`)
  }

  return (data as TagRow[]) ?? []
}

// ---------------------------------------------------------------------------
// Promoted tags — tags with enough stories to appear in feed navigation
// ---------------------------------------------------------------------------

export async function queryPromotedTags(
  client: SupabaseClient<Database>,
  options?: { threshold?: number; limit?: number }
): Promise<TagRow[]> {
  const threshold = options?.threshold ?? PROMOTED_TAG_THRESHOLD
  const limit = options?.limit ?? PROMOTED_TAG_LIMIT

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('tags') as any)
    .select('id, slug, label, description, tag_type, story_count, created_at')
    .gte('story_count', threshold)
    .order('story_count', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to query promoted tags: ${error.message}`)
  }

  return (data as TagRow[]) ?? []
}
