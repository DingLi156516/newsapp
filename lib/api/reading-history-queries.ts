/**
 * lib/api/reading-history-queries.ts — Supabase query helpers for reading history.
 *
 * Provides functions to mark stories as read/unread and query reading history.
 * Uses the reading_history table created in 003_bookmarks.sql.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

interface ReadingHistoryRow {
  readonly id: string
  readonly user_id: string
  readonly story_id: string
  readonly read_at: string
  readonly is_read: boolean
}

export async function queryReadingHistory(
  client: SupabaseClient<Database>,
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ data: ReadingHistoryRow[]; count: number }> {
  const offset = (page - 1) * limit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, count, error } = await (client.from('reading_history') as any)
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_read', true)
    .order('read_at', { ascending: false })
    .order('story_id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(`Failed to query reading history: ${error.message}`)
  }

  return { data: data ?? [], count: count ?? 0 }
}

export async function queryReadStoryIds(
  client: SupabaseClient<Database>,
  userId: string
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('reading_history') as any)
    .select('story_id')
    .eq('user_id', userId)
    .eq('is_read', true)

  if (error) {
    throw new Error(`Failed to query read story IDs: ${error.message}`)
  }

  return (data ?? []).map((row: { story_id: string }) => row.story_id)
}

export async function upsertReadingHistory(
  client: SupabaseClient<Database>,
  userId: string,
  storyId: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from('reading_history') as any)
    .upsert(
      { user_id: userId, story_id: storyId, is_read: true, read_at: new Date().toISOString() },
      { onConflict: 'user_id,story_id' }
    )

  if (error) {
    throw new Error(`Failed to mark story as read: ${error.message}`)
  }
}

export async function markAsUnread(
  client: SupabaseClient<Database>,
  userId: string,
  storyId: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from('reading_history') as any)
    .update({ is_read: false })
    .eq('user_id', userId)
    .eq('story_id', storyId)

  if (error) {
    throw new Error(`Failed to mark story as unread: ${error.message}`)
  }
}
