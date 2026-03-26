import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export interface PipelineBacklog {
  readonly unembeddedArticles: number
  readonly unclusteredArticles: number
  readonly pendingAssemblyStories: number
  readonly reviewQueueStories: number
  readonly expiredArticles: number
}

export async function countPipelineBacklog(
  client: SupabaseClient<Database>
): Promise<PipelineBacklog> {
  const [unembedded, unclustered, pendingAssembly, reviewQueue, expired] = await Promise.all([
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

  return {
    unembeddedArticles: unembedded.count ?? 0,
    unclusteredArticles: unclustered.count ?? 0,
    pendingAssemblyStories: pendingAssembly.count ?? 0,
    reviewQueueStories: reviewQueue.count ?? 0,
    expiredArticles: expired.count ?? 0,
  }
}
