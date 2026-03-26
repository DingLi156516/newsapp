/**
 * GET /api/dashboard/bias-profile — Compute user's reading bias distribution.
 *
 * Joins reading_history with stories to aggregate spectrum data.
 * Returns the user's bias profile with blindspot detection.
 */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { computeBiasProfile } from '@/lib/api/bias-calculator'
import type { StoryWithSpectrum } from '@/lib/api/bias-calculator'

export async function GET() {
  const { user, error: authError, supabase } = await getAuthenticatedUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Get user's read story IDs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: historyRows, error: historyError } = await (supabase.from('reading_history') as any)
      .select('story_id')
      .eq('user_id', user.id)
      .eq('is_read', true)

    if (historyError) {
      throw new Error(`Failed to fetch reading history: ${historyError.message}`)
    }

    const readStoryIds = (historyRows ?? []).map((r: { story_id: string }) => r.story_id)

    // Fetch spectrum data for read stories
    let userStories: StoryWithSpectrum[] = []
    if (readStoryIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userStoriesData, error: userError } = await (supabase.from('stories') as any)
        .select('spectrum_segments')
        .in('id', readStoryIds)

      if (userError) {
        throw new Error(`Failed to fetch user stories: ${userError.message}`)
      }
      userStories = (userStoriesData ?? []) as StoryWithSpectrum[]
    }

    // Fetch all stories for overall distribution
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allStories, error: allError } = await (supabase.from('stories') as any)
      .select('spectrum_segments')
      .eq('publication_status', 'published')

    if (allError) {
      throw new Error(`Failed to fetch all stories: ${allError.message}`)
    }

    const profile = computeBiasProfile(userStories, (allStories ?? []) as StoryWithSpectrum[])

    return NextResponse.json({ success: true, data: profile })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
