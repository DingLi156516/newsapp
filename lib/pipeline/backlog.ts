import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export interface PipelineBacklogAgeSummary {
  readonly unembeddedArticles: number | null
  readonly unclusteredArticles: number | null
  readonly pendingAssemblyStories: number | null
  readonly reviewQueueStories: number | null
  readonly expiredArticles: number | null
}

export interface PipelineBacklog {
  readonly unembeddedArticles: number
  readonly unclusteredArticles: number
  readonly pendingAssemblyStories: number
  readonly reviewQueueStories: number
  readonly expiredArticles: number
  readonly oldestAgeMinutes?: PipelineBacklogAgeSummary
}

export interface CountPipelineBacklogOptions {
  readonly includeAges?: boolean
}

function toOldestAgeMinutes(timestamp: string | null | undefined, nowMs: number): number | null {
  if (!timestamp) {
    return null
  }

  const parsedMs = new Date(timestamp).getTime()
  if (Number.isNaN(parsedMs)) {
    return null
  }

  return Math.max(0, Math.round((nowMs - parsedMs) / 60_000))
}

async function fetchOldestTimestamp(
  client: SupabaseClient<Database>,
  table: 'articles' | 'stories',
  column: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: (query: any) => any
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseQuery = (client.from(table) as any).select(column).order(column, { ascending: true }).limit(1)
  const { data, error } = await buildQuery(baseQuery)

  if (error || !data || data.length === 0) {
    return null
  }

  const row = data[0] as Record<string, unknown>
  const value = row[column]
  return typeof value === 'string' ? value : null
}

export async function countPipelineBacklog(
  client: SupabaseClient<Database>,
  options: CountPipelineBacklogOptions = {}
): Promise<PipelineBacklog> {
  const counts = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client.from('articles') as any).select('id', { count: 'exact' }).eq('is_embedded', false),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client.from('articles') as any).select('id', { count: 'exact' }).eq('is_embedded', true).is('story_id', null).eq('clustering_status', 'pending'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client.from('stories') as any).select('id', { count: 'exact' }).eq('assembly_status', 'pending'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client.from('stories') as any).select('id', { count: 'exact' }).eq('publication_status', 'needs_review'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client.from('articles') as any).select('id', { count: 'exact' }).eq('clustering_status', 'expired'),
  ])

  const [unembedded, unclustered, pendingAssembly, reviewQueue, expired] = counts

  if (!options.includeAges) {
    return {
      unembeddedArticles: unembedded.count ?? 0,
      unclusteredArticles: unclustered.count ?? 0,
      pendingAssemblyStories: pendingAssembly.count ?? 0,
      reviewQueueStories: reviewQueue.count ?? 0,
      expiredArticles: expired.count ?? 0,
    }
  }

  const nowMs = Date.now()
  const [
    oldestUnembedded,
    oldestUnclustered,
    oldestPendingAssembly,
    oldestReviewQueue,
    oldestExpired,
  ] = await Promise.all([
    fetchOldestTimestamp(client, 'articles', 'created_at', (query) => query.eq('is_embedded', false)),
    fetchOldestTimestamp(
      client,
      'articles',
      'created_at',
      (query) => query.eq('is_embedded', true).is('story_id', null).eq('clustering_status', 'pending')
    ),
    fetchOldestTimestamp(client, 'stories', 'last_updated', (query) => query.eq('assembly_status', 'pending')),
    fetchOldestTimestamp(client, 'stories', 'last_updated', (query) => query.eq('publication_status', 'needs_review')),
    fetchOldestTimestamp(client, 'articles', 'published_at', (query) => query.eq('clustering_status', 'expired')),
  ])

  return {
    unembeddedArticles: unembedded.count ?? 0,
    unclusteredArticles: unclustered.count ?? 0,
    pendingAssemblyStories: pendingAssembly.count ?? 0,
    reviewQueueStories: reviewQueue.count ?? 0,
    expiredArticles: expired.count ?? 0,
    oldestAgeMinutes: {
      unembeddedArticles: toOldestAgeMinutes(oldestUnembedded, nowMs),
      unclusteredArticles: toOldestAgeMinutes(oldestUnclustered, nowMs),
      pendingAssemblyStories: toOldestAgeMinutes(oldestPendingAssembly, nowMs),
      reviewQueueStories: toOldestAgeMinutes(oldestReviewQueue, nowMs),
      expiredArticles: toOldestAgeMinutes(oldestExpired, nowMs),
    },
  }
}
