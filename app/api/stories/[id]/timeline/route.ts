/**
 * GET /api/stories/[id]/timeline — Story coverage timeline.
 *
 * Returns: { success: true, data: StoryTimeline }
 * Computes timeline events on-read from articles joined with sources.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { queryArticlesWithSourcesForStory } from '@/lib/api/query-helpers'
import { transformTimeline } from '@/lib/api/timeline-transformer'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id || typeof id !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Missing story ID' },
      { status: 400 }
    )
  }

  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { success: false, error: 'Invalid story ID format' },
      { status: 400 }
    )
  }

  try {
    const client = getSupabaseServerClient()
    const articles = await queryArticlesWithSourcesForStory(client, id)
    const timeline = transformTimeline(id, articles)

    return NextResponse.json({
      success: true,
      data: timeline,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
