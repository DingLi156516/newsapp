/**
 * lib/api/owner-queries.ts — Supabase query helpers for media owners.
 *
 * Provides list (with source count) and detail (with sources array) queries.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, DbMediaOwner } from '@/lib/supabase/types'
import type { OwnersQuery } from '@/lib/api/owner-validation'
import type { Region, Topic } from '@/lib/types'

interface OwnerRow extends DbMediaOwner {
  source_count: number
}

interface SourceRow {
  id: string
  slug: string
  name: string
  bias: string
  factuality: string
  ownership: string
  url: string | null
  region: string
}

interface OwnerProfileStoryRow {
  id: string
  headline: string
  topic: Topic
  region: Region
  timestamp: string
  isBlindspot: boolean
  articleUrl?: string
}

/**
 * Owner profile window — mirrors OWNER_FILTER_WINDOW_DAYS in query-helpers.ts.
 * 180 days is the same "recent coverage" contract the feed filter advertises.
 */
const OWNER_PROFILE_WINDOW_DAYS = 180

interface OwnerArticleJoinRow {
  url: string | null
  published_at: string | null
  fetched_at: string | null
  stories: {
    id: string
    headline: string
    topic: string
    region: string
    is_blindspot: boolean
    first_published: string
    last_updated: string
    publication_status?: string
  } | null
}

export async function queryOwners(
  client: SupabaseClient<Database>,
  params: OwnersQuery
): Promise<{ data: OwnerRow[]; count: number }> {
  const { search, owner_type, page, limit } = params
  const offset = (page - 1) * limit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client.from('media_owners') as any)
    // Note: source_count includes inactive sources — acceptable for MVP (all 20 seeded sources active)
    .select('*, source_count:sources(count)', { count: 'exact' })

  if (owner_type) {
    query = query.eq('owner_type', owner_type)
  }

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  query = query
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    throw new Error(`Failed to query owners: ${error.message}`)
  }

  // Supabase returns embedded aggregates as [{count: N}] — normalize to flat number
  const normalized = (data ?? []).map((row: Record<string, unknown>) => {
    const rawCount = row.source_count
    const sourceCount = Array.isArray(rawCount) && rawCount.length > 0
      ? (rawCount[0] as { count: number }).count
      : typeof rawCount === 'number'
        ? rawCount
        : 0
    return { ...row, source_count: sourceCount } as OwnerRow
  })

  return { data: normalized, count: count ?? 0 }
}

export async function queryOwnerById(
  client: SupabaseClient<Database>,
  id: string
): Promise<{ owner: DbMediaOwner; sources: SourceRow[] } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: owner, error: ownerError } = await (client.from('media_owners') as any)
    .select('*')
    .eq('id', id)
    .single()

  if (ownerError) {
    if (ownerError.code === 'PGRST116') return null
    throw new Error(`Failed to fetch owner: ${ownerError.message}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sources, error: sourceError } = await (client.from('sources') as any)
    .select('id, slug, name, bias, factuality, ownership, url, region')
    .eq('owner_id', id)
    .eq('is_active', true)

  if (sourceError) {
    throw new Error(`Failed to fetch sources for owner: ${sourceError.message}`)
  }

  return { owner, sources: sources ?? [] }
}

export async function queryOwnerBySlug(
  client: SupabaseClient<Database>,
  slug: string
): Promise<{ owner: DbMediaOwner; sources: SourceRow[] } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: owner, error: ownerError } = await (client.from('media_owners') as any)
    .select('*')
    .eq('slug', slug)
    .single()

  if (ownerError) {
    if (ownerError.code === 'PGRST116') return null
    throw new Error(`Failed to fetch owner: ${ownerError.message}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sources, error: sourceError } = await (client.from('sources') as any)
    .select('id, slug, name, bias, factuality, ownership, url, region')
    .eq('owner_id', owner.id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (sourceError) {
    throw new Error(`Failed to fetch sources for owner: ${sourceError.message}`)
  }

  return { owner, sources: sources ?? [] }
}

/**
 * Returns distinct published stories covered by any active source owned by
 * this owner within the 180-day window. Mirrors the pattern in
 * `queryRecentStoriesForSource` but keyed on owner via a preliminary sources
 * lookup.
 */
export async function queryRecentStoriesForOwner(
  client: SupabaseClient<Database>,
  ownerId: string
): Promise<OwnerProfileStoryRow[]> {
  // Active-only: rollups must describe the same source set the profile page
  // lists. `queryOwnerBySlug` filters on `is_active=true`, so the recent-
  // coverage query has to match or stories from retired outlets will appear
  // in counts and topic mixes that the user can't explain from the source list.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sourceRows, error: sourcesError } = await (client.from('sources') as any)
    .select('id')
    .eq('owner_id', ownerId)
    .eq('is_active', true)

  if (sourcesError) {
    throw new Error(`Failed to fetch sources for owner: ${sourcesError.message}`)
  }

  const sourceIds = ((sourceRows ?? []) as Array<{ id: string }>).map((r) => r.id)
  if (sourceIds.length === 0) return []

  const windowIso = new Date(
    Date.now() - OWNER_PROFILE_WINDOW_DAYS * 24 * 3_600_000
  ).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('articles') as any)
    .select(
      `
        url,
        published_at,
        fetched_at,
        stories!articles_story_id_fkey(
          id,
          headline,
          topic,
          region,
          is_blindspot,
          first_published,
          last_updated,
          publication_status
        )
      `
    )
    .in('source_id', sourceIds)
    .not('story_id', 'is', null)
    .or(`published_at.gte.${windowIso},and(published_at.is.null,fetched_at.gte.${windowIso})`)
    // Deterministic ordering: published_at → fetched_at → id. The final id
    // tie-breaker matters because the dedup loop below keeps the first row
    // per story.id and exposes its `url` as `articleUrl`; without a stable
    // tie-breaker the profile would flip articleUrls between requests when
    // two articles share a timestamp. Mirrors queryRecentStoriesForSource.
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('fetched_at', { ascending: false })
    .order('id', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch recent stories for owner: ${error.message}`)
  }

  if (!data || data.length === 0) return []

  const storiesById = new Map<string, OwnerProfileStoryRow>()
  for (const row of data as OwnerArticleJoinRow[]) {
    if (!row.stories) continue
    if (row.stories.publication_status && row.stories.publication_status !== 'published') continue
    if (storiesById.has(row.stories.id)) continue

    storiesById.set(row.stories.id, {
      id: row.stories.id,
      headline: row.stories.headline,
      topic: row.stories.topic as Topic,
      region: row.stories.region as Region,
      timestamp:
        row.stories.last_updated ??
        row.stories.first_published ??
        row.published_at ??
        row.fetched_at ??
        new Date().toISOString(),
      isBlindspot: row.stories.is_blindspot,
      ...(row.url ? { articleUrl: row.url } : {}),
    })
  }

  return [...storiesById.values()]
}
