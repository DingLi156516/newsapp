/**
 * GET /api/dashboard/suggestions — Stories from underrepresented bias categories.
 *
 * Uses the bias profile to find categories the user reads less, then returns
 * stories where those categories dominate the spectrum.
 */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { computeBiasProfile } from '@/lib/api/bias-calculator'
import type { StoryWithSpectrum } from '@/lib/api/bias-calculator'
import { transformStoryList } from '@/lib/api/transformers'

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

    // Fetch all stories
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allStories, error: allError } = await (supabase.from('stories') as any)
      .select(
        'id, headline, topic, region, source_count, is_blindspot, image_url, factuality, ownership, spectrum_segments, ai_summary, first_published, last_updated'
      )
      .eq('publication_status', 'published')
      .order('last_updated', { ascending: false })
      .limit(100)

    if (allError) {
      throw new Error(`Failed to fetch all stories: ${allError.message}`)
    }

    const profile = computeBiasProfile(userStories, (allStories ?? []) as StoryWithSpectrum[])

    // Filter stories that have significant coverage from blindspot categories
    const blindspotSet = new Set(profile.blindspots)
    const readIdSet = new Set(readStoryIds)

    const suggestions = (allStories ?? [])
      .filter((story: { id: string; spectrum_segments: { bias: string; percentage: number }[] }) => {
        if (readIdSet.has(story.id)) return false
        if (!Array.isArray(story.spectrum_segments)) return false

        const blindspotPct = story.spectrum_segments
          .filter((s: { bias: string }) => blindspotSet.has(s.bias as never))
          .reduce((sum: number, s: { percentage: number }) => sum + s.percentage, 0)

        return blindspotPct >= 30
      })
      .slice(0, 10)
      .map(transformStoryList)

    return NextResponse.json({ success: true, data: suggestions })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
