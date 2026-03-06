/**
 * lib/api/bookmark-queries.ts — Supabase query helpers for bookmarks.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export async function queryBookmarks(
  client: SupabaseClient<Database>,
  userId: string
): Promise<{ storyIds: string[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('bookmarks') as any)
    .select('story_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to query bookmarks: ${error.message}`)
  }

  return { storyIds: (data ?? []).map((row: { story_id: string }) => row.story_id) }
}

export async function insertBookmark(
  client: SupabaseClient<Database>,
  userId: string,
  storyId: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from('bookmarks') as any)
    .upsert({ user_id: userId, story_id: storyId }, { onConflict: 'user_id,story_id' })

  if (error) {
    throw new Error(`Failed to add bookmark: ${error.message}`)
  }
}

export async function deleteBookmark(
  client: SupabaseClient<Database>,
  userId: string,
  storyId: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from('bookmarks') as any)
    .delete()
    .eq('user_id', userId)
    .eq('story_id', storyId)

  if (error) {
    throw new Error(`Failed to remove bookmark: ${error.message}`)
  }
}
