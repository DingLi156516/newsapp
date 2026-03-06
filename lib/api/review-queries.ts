/**
 * lib/api/review-queries.ts — Supabase query helpers for admin review queue.
 *
 * Provides paginated queue listing, status updates, and aggregate stats.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { ReviewAction, ReviewQueueQuery } from '@/lib/api/review-validation'

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
      'id, headline, topic, region, source_count, is_blindspot, image_url, factuality, ownership, spectrum_segments, ai_summary, review_status, reviewed_by, reviewed_at, first_published, last_updated',
      { count: 'exact' }
    )

  if (status) {
    query = query.eq('review_status', status)
  }

  query = query
    .order('last_updated', { ascending: false })
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {
    reviewed_by: adminUserId,
    reviewed_at: new Date().toISOString(),
  }

  switch (action.action) {
    case 'approve':
      updateData.review_status = 'approved'
      if (action.headline) {
        updateData.headline = action.headline
      }
      if (action.ai_summary) {
        updateData.ai_summary = action.ai_summary
      }
      break
    case 'reject':
      updateData.review_status = 'rejected'
      break
    case 'reprocess':
      updateData.review_status = 'pending'
      updateData.headline = 'Pending headline generation'
      updateData.ai_summary = {
        commonGround: '',
        leftFraming: '',
        rightFraming: '',
      }
      updateData.reviewed_by = null
      updateData.reviewed_at = null
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
        .eq('review_status', status)
        .neq('headline', 'Pending headline generation')

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
