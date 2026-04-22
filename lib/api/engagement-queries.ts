/**
 * lib/api/engagement-queries.ts — Supabase query helpers for story_views.
 *
 * The route layer uses `insertStoryViewEvent` for the write path. The
 * remaining helpers feed ranking + dashboard reads:
 *
 *   - queryUniqueViewersForStory: powers the engagement_factor multiplier
 *     in trending refresh (per-story aggregation, last N hours).
 *   - queryTopEngagedStories: powers the Hot Now dashboard card.
 *   - queryReadThroughStoryIds: powers For-You's read-similar bonus —
 *     "what has this user actually finished reading lately?"
 *
 * All reads count distinct session_id so a single reader who refreshes
 * five times in an hour does not five-times-multiply the score.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, DbStoryViewInsert, StoryViewAction } from '@/lib/supabase/types'

export type StoryViewInsertInput = DbStoryViewInsert

export async function insertStoryViewEvent(
  client: SupabaseClient<Database>,
  event: StoryViewInsertInput
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from('story_views') as any).insert(event)

  if (error) {
    // Unique-violation is the dedupe path — same session+story+action+minute.
    // Treat as success: the row already exists, the signal is intact.
    if (error.code === '23505') return
    throw new Error(`Failed to insert story view event: ${error.message}`)
  }
}

export interface UniqueViewersResult {
  readonly storyId: string
  readonly uniqueViewers: number
}

/**
 * Distinct sessions for one story over the last N hours, restricted to a
 * single action ('view' by default — the broadest and earliest signal).
 */
export async function queryUniqueViewersForStory(
  client: SupabaseClient<Database>,
  storyId: string,
  windowHours: number,
  action: StoryViewAction = 'view'
): Promise<UniqueViewersResult> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('story_views') as any)
    .select('session_id')
    .eq('story_id', storyId)
    .eq('action', action)
    .gte('created_at', since)

  if (error) {
    throw new Error(`Failed to query unique viewers: ${error.message}`)
  }

  const sessions = new Set<string>()
  for (const row of (data ?? []) as ReadonlyArray<{ session_id: string }>) {
    sessions.add(row.session_id)
  }
  return { storyId, uniqueViewers: sessions.size }
}

export interface TopEngagedStory {
  readonly storyId: string
  readonly uniqueViewers: number
}

/**
 * Top N stories by distinct-session view count over the window.
 * Read-side aggregation in JS — at our volume (Phase 3 day-1 traffic) the
 * row counts stay small. A materialized rollup is the natural follow-up
 * when this query starts to dominate the response budget.
 */
export async function queryTopEngagedStories(
  client: SupabaseClient<Database>,
  windowHours: number,
  limit: number,
  action: StoryViewAction = 'view'
): Promise<TopEngagedStory[]> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('story_views') as any)
    .select('story_id, session_id')
    .eq('action', action)
    .gte('created_at', since)

  if (error) {
    throw new Error(`Failed to query top engaged stories: ${error.message}`)
  }

  const sessionsByStory = new Map<string, Set<string>>()
  for (const row of (data ?? []) as ReadonlyArray<{ story_id: string; session_id: string }>) {
    let bucket = sessionsByStory.get(row.story_id)
    if (!bucket) {
      bucket = new Set<string>()
      sessionsByStory.set(row.story_id, bucket)
    }
    bucket.add(row.session_id)
  }

  return Array.from(sessionsByStory.entries())
    .map(([storyId, sessions]) => ({ storyId, uniqueViewers: sessions.size }))
    .sort((a, b) => b.uniqueViewers - a.uniqueViewers)
    .slice(0, limit)
}

/**
 * Story IDs the user has read through (≥80% scroll) within the window.
 * For-You uses this to compute its "reading-similar" topic+region bonus.
 */
export async function queryReadThroughStoryIds(
  client: SupabaseClient<Database>,
  userId: string,
  windowDays: number
): Promise<string[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('story_views') as any)
    .select('story_id')
    .eq('user_id', userId)
    .eq('action', 'read_through')
    .gte('created_at', since)

  if (error) {
    throw new Error(`Failed to query read-through stories: ${error.message}`)
  }

  const ids = new Set<string>()
  for (const row of (data ?? []) as ReadonlyArray<{ story_id: string }>) {
    ids.add(row.story_id)
  }
  return Array.from(ids)
}
