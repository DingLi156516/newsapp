/**
 * GET /api/stories/[id] — Single story detail with joined sources.
 *
 * Returns: { story: NewsArticle } where sources are populated from
 * the articles→sources join.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { queryStoryById, querySourcesForStory } from '@/lib/api/query-helpers'
import { transformStory } from '@/lib/api/transformers'
import type { DbSource } from '@/lib/supabase/types'

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

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { success: false, error: 'Invalid story ID format' },
      { status: 400 }
    )
  }

  try {
    const client = getSupabaseServerClient()
    const story = await queryStoryById(client, id)

    if (!story) {
      return NextResponse.json(
        { success: false, error: 'Story not found' },
        { status: 404 }
      )
    }

    const sourceRows = await querySourcesForStory(client, id)
    const transformed = transformStory(story, sourceRows as DbSource[])

    return NextResponse.json({
      success: true,
      data: transformed,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
