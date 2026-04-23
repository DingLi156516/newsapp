/**
 * lib/api/pipeline-journey.ts — resolves a free-text query (URL or
 * UUID) to an article(s) + (optional) story journey state, plus
 * related stage events and DLQ entries.
 *
 * Operator paste flow:
 *  - Paste an article URL → matches articles.url or canonical_url.
 *  - Paste an article UUID → fetches article by id.
 *  - Paste a story UUID → fetches story + every article in the cluster.
 *
 * Returned shape powers PipelineJourneyLookup, which renders a
 * vertical Ingested → Embedded → Clustered → Assembled → Published
 * timeline.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, DbArticle, DbStory, DbPipelineStageEvent } from '@/lib/supabase/types'
import { normalizeArticleUrl } from '@/lib/rss/normalization'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface JourneyDlqEntry {
  readonly id: string
  readonly itemKind: 'article_embed' | 'article_cluster' | 'story_assemble'
  readonly itemId: string
  readonly retryCount: number
  readonly lastError: string
  readonly failedAt: string
  readonly replayedAt: string | null
}

export interface JourneyResult {
  readonly query: string
  readonly resolved: 'article' | 'story' | 'none'
  readonly articles: DbArticle[]
  readonly story: DbStory | null
  readonly events: DbPipelineStageEvent[]
  readonly dlq: JourneyDlqEntry[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<Database> | any

function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

async function fetchEventsForItems(client: Client, itemIds: string[]): Promise<DbPipelineStageEvent[]> {
  if (itemIds.length === 0) return []
  const { data, error } = await client
    .from('pipeline_stage_events')
    .select('*')
    .in('item_id', itemIds)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(`Failed to load events: ${error.message}`)
  return (data ?? []) as DbPipelineStageEvent[]
}

async function fetchDlqForItems(client: Client, itemIds: string[]): Promise<JourneyDlqEntry[]> {
  if (itemIds.length === 0) return []
  // Only unreplayed entries — a replayed DLQ row means the item was
  // requeued, so it should not be presented as a current pipeline failure.
  const { data, error } = await client
    .from('pipeline_dead_letter')
    .select('id, item_kind, item_id, retry_count, last_error, failed_at, replayed_at')
    .in('item_id', itemIds)
    .is('replayed_at', null)
    .order('failed_at', { ascending: false })
  if (error) throw new Error(`Failed to load DLQ entries: ${error.message}`)
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    itemKind: row.item_kind as JourneyDlqEntry['itemKind'],
    itemId: row.item_id as string,
    retryCount: row.retry_count as number,
    lastError: row.last_error as string,
    failedAt: row.failed_at as string,
    replayedAt: (row.replayed_at as string | null) ?? null,
  }))
}

async function fetchArticleByUuid(client: Client, id: string): Promise<DbArticle | null> {
  const { data, error } = await client.from('articles').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`Failed to fetch article: ${error.message}`)
  return (data as DbArticle | null) ?? null
}

async function fetchArticleByUrl(client: Client, url: string): Promise<DbArticle | null> {
  // Two separate exact-match queries instead of `.or()` — pasted URLs
  // routinely contain commas / parentheses (tracking params, etc.) that
  // would change PostgREST's filter grammar if interpolated into an OR
  // expression.
  //
  // Articles store `canonical_url` via normalizeArticleUrl(item.url), so a
  // raw browser-pasted URL with tracking params or hash fragments would
  // never match the canonical column without first normalizing the input.
  const normalized = (() => {
    try { return normalizeArticleUrl(url) } catch { return url }
  })()

  const [byUrl, byCanonical] = await Promise.all([
    client
      .from('articles')
      .select('*')
      .eq('url', url)
      .order('ingested_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from('articles')
      .select('*')
      .eq('canonical_url', normalized)
      .order('ingested_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (byUrl?.error) throw new Error(`Failed to fetch article by url: ${byUrl.error.message}`)
  if (byCanonical?.error) throw new Error(`Failed to fetch article by canonical_url: ${byCanonical.error.message}`)
  return ((byUrl?.data ?? byCanonical?.data) as DbArticle | null) ?? null
}

async function fetchStoryByUuid(client: Client, id: string): Promise<DbStory | null> {
  const { data, error } = await client.from('stories').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`Failed to fetch story: ${error.message}`)
  return (data as DbStory | null) ?? null
}

async function fetchArticlesForStory(client: Client, storyId: string): Promise<DbArticle[]> {
  const { data, error } = await client
    .from('articles')
    .select('*')
    .eq('story_id', storyId)
    .order('ingested_at', { ascending: false })
  if (error) throw new Error(`Failed to fetch story articles: ${error.message}`)
  return (data as DbArticle[] | null) ?? []
}

async function fetchStoryForArticle(client: Client, article: DbArticle): Promise<DbStory | null> {
  if (!article.story_id) return null
  return fetchStoryByUuid(client, article.story_id)
}

export async function resolveJourneyQuery(
  client: Client,
  rawQuery: string
): Promise<JourneyResult> {
  const query = rawQuery.trim()
  if (!query) {
    return { query, resolved: 'none', articles: [], story: null, events: [], dlq: [] }
  }

  if (isUuid(query)) {
    // Try article first, then story.
    const article = await fetchArticleByUuid(client, query)
    if (article) {
      const story = await fetchStoryForArticle(client, article)
      const itemIds = [article.id, ...(story ? [story.id] : [])]
      const [events, dlq] = await Promise.all([
        fetchEventsForItems(client, itemIds),
        fetchDlqForItems(client, itemIds),
      ])
      return { query, resolved: 'article', articles: [article], story, events, dlq }
    }

    const story = await fetchStoryByUuid(client, query)
    if (story) {
      const articles = await fetchArticlesForStory(client, story.id)
      const itemIds = [story.id, ...articles.map((a) => a.id)]
      const [events, dlq] = await Promise.all([
        fetchEventsForItems(client, itemIds),
        fetchDlqForItems(client, itemIds),
      ])
      return { query, resolved: 'story', articles, story, events, dlq }
    }

    return { query, resolved: 'none', articles: [], story: null, events: [], dlq: [] }
  }

  // Treat as URL.
  const article = await fetchArticleByUrl(client, query)
  if (!article) {
    return { query, resolved: 'none', articles: [], story: null, events: [], dlq: [] }
  }
  const story = await fetchStoryForArticle(client, article)
  const itemIds = [article.id, ...(story ? [story.id] : [])]
  const [events, dlq] = await Promise.all([
    fetchEventsForItems(client, itemIds),
    fetchDlqForItems(client, itemIds),
  ])
  return { query, resolved: 'article', articles: [article], story, events, dlq }
}
