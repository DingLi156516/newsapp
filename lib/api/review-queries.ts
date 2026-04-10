/**
 * lib/api/review-queries.ts — Supabase query helpers for admin review queue.
 *
 * Provides paginated queue listing, status updates, and aggregate stats.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { ReviewAction, ReviewQueueQuery } from '@/lib/api/review-validation'
import { fetchAssemblyVersions, requeueStoryForReassembly } from '@/lib/pipeline/reassembly'

interface ReviewStoryRow {
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
  assembly_status: string
  publication_status: string
  review_reasons: string[]
  confidence_score: number | null
  processing_error: string | null
  assembled_at: string | null
  published_at: string | null
  review_status: string
  reviewed_by: string | null
  reviewed_at: string | null
  first_published: string
  last_updated: string
}

export async function queryReviewQueue(
  client: SupabaseClient<Database>,
  params: ReviewQueueQuery
): Promise<{ data: ReviewStoryRow[]; count: number }> {
  const { status, page, limit } = params
  const offset = (page - 1) * limit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client.from('stories') as any)
    .select(
      'id, headline, topic, region, source_count, is_blindspot, image_url, factuality, ownership, spectrum_segments, ai_summary, assembly_status, publication_status, review_reasons, confidence_score, processing_error, assembled_at, published_at, review_status, reviewed_by, reviewed_at, first_published, last_updated',
      { count: 'exact' }
    )

  if (status) {
    const publicationStatus = status === 'pending'
      ? 'needs_review'
      : status === 'approved'
        ? 'published'
        : 'rejected'
    query = query.eq('publication_status', publicationStatus)
  }

  query = query
    .order('last_updated', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    throw new Error(`Failed to query review queue: ${error.message}`)
  }

  return { data: data ?? [], count: count ?? 0 }
}

export async function updateReviewStatus(
  client: SupabaseClient<Database>,
  storyId: string,
  adminUserId: string,
  action: ReviewAction
): Promise<void> {
  // Reprocess is the only guarded path: its reset (status + claim + retry
  // metadata + content wipe) all happens atomically inside the guarded
  // `requeue_story_for_reassembly` RPC (migration 042). If the story is
  // currently assembling or its assembly_version moved, the RPC returns
  // false and we surface a conflict — the story is left fully intact.
  //
  // This fixes the earlier bug where we committed destructive metadata
  // resets (headline, ai_summary, assembled_at, reviewer fields) BEFORE
  // attempting the CAS, which could wipe content on a story that the
  // reprocess wasn't actually allowed to touch.
  if (action.action === 'reprocess') {
    const versions = await fetchAssemblyVersions(client, [storyId])
    const expectedVersion = versions.get(storyId)
    if (expectedVersion === undefined) {
      throw new Error(`Failed to reprocess story ${storyId}: missing assembly_version`)
    }

    const requeued = await requeueStoryForReassembly(
      client,
      storyId,
      expectedVersion,
      true /* clearContent: wipe headline/ai_summary/assembled_at atomically */
    )
    if (!requeued) {
      throw new Error(
        `Story ${storyId} is currently being assembled; reprocess was not applied. ` +
          `Retry after assembly completes.`
      )
    }
    return
  }

  // Approve / reject paths are not guarded — they only touch review
  // metadata and publication status, never the assembly lifecycle.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {
    reviewed_by: adminUserId,
    reviewed_at: new Date().toISOString(),
  }

  switch (action.action) {
    case 'approve':
      updateData.review_status = 'approved'
      updateData.publication_status = 'published'
      updateData.published_at = new Date().toISOString()
      if (action.headline) {
        updateData.headline = action.headline
      }
      if (action.ai_summary) {
        updateData.ai_summary = action.ai_summary
      }
      break
    case 'reject':
      updateData.review_status = 'rejected'
      updateData.publication_status = 'rejected'
      break
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from('stories') as any)
    .update(updateData)
    .eq('id', storyId)

  if (error) {
    throw new Error(`Failed to update review status: ${error.message}`)
  }
}

export async function queryReviewStats(
  client: SupabaseClient<Database>
): Promise<{ pending: number; approved: number; rejected: number }> {
  const statuses = ['pending', 'approved', 'rejected'] as const

  const results = await Promise.all(
    statuses.map(async (status) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count, error } = await (client.from('stories') as any)
        .select('id', { count: 'exact' })
        .eq(
          'publication_status',
          status === 'pending'
            ? 'needs_review'
            : status === 'approved'
              ? 'published'
              : 'rejected'
        )

      if (error) {
        throw new Error(`Failed to query review stats: ${error.message}`)
      }

      return count ?? 0
    })
  )

  return {
    pending: results[0],
    approved: results[1],
    rejected: results[2],
  }
}
