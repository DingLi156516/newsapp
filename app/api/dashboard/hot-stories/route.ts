/**
 * GET /api/dashboard/hot-stories — Top stories by recent unique-viewer count.
 *
 * Authenticated route. Reads engagement signals from story_views (last 6h),
 * joins to the published stories pool, and returns the top 5 in NewsArticle
 * shape. The Hot Now dashboard card consumes this — it is the single
 * user-facing surface for the engagement-capture pipeline.
 *
 * Cache: `private, max-age=30` so a single user's repeated dashboard
 * opens within the window are cheap, but a shared CDN cannot serve one
 * authenticated user's payload to another. We deliberately do *not* use
 * `s-maxage` because the response varies per cookie/Bearer.
 */

const HOT_CACHE_HEADERS = { 'Cache-Control': 'private, max-age=30' } as const

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { queryTopEngagedStories } from '@/lib/api/engagement-queries'
import { transformStoryList } from '@/lib/api/transformers'

const HOT_WINDOW_HOURS = 6
const HOT_LIMIT = 5

export async function GET() {
  const { user, error: authError, supabase } = await getAuthenticatedUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Engagement reads must go through the service-role client because
    // story_views has SELECT-admin-only RLS (the user_id column is
    // privacy-sensitive). We then use the user-auth `supabase` client
    // for the stories fetch — RLS allows public read of published rows
    // and we want any future per-user filtering to apply consistently.
    const service = getSupabaseServiceClient()
    const top = await queryTopEngagedStories(service, HOT_WINDOW_HOURS, HOT_LIMIT)

    if (top.length === 0) {
      return NextResponse.json(
        { success: true, data: [] },
        { headers: HOT_CACHE_HEADERS }
      )
    }

    const ids = top.map((t) => t.storyId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stories, error } = await (supabase.from('stories') as any)
      .select(
        'id, headline, topic, region, source_count, is_blindspot, image_url, factuality, ownership, spectrum_segments, ai_summary, published_at, first_published, last_updated'
      )
      .in('id', ids)
      .eq('publication_status', 'published')

    if (error) {
      throw new Error(`Failed to fetch hot stories: ${error.message}`)
    }

    // Reorder to match the engagement ranking (the IN query loses order).
    const byId = new Map<string, unknown>()
    for (const story of (stories ?? []) as { id: string }[]) {
      byId.set(story.id, story)
    }
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((s): s is { id: string } => s !== undefined)
      .map((s) => ({
        ...transformStoryList(s as never),
        uniqueViewers6h:
          top.find((t) => t.storyId === (s as { id: string }).id)?.uniqueViewers ?? 0,
      }))

    return NextResponse.json(
      { success: true, data: ordered },
      { headers: HOT_CACHE_HEADERS }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
