/**
 * GET /api/tags/promoted — Tags with enough stories to appear in feed navigation.
 *
 * Returns tags whose story_count >= threshold, sorted by story_count DESC.
 * Optional query params: ?threshold=N&limit=N
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { queryPromotedTags } from '@/lib/api/query-helpers'
import { transformTag } from '@/lib/api/transformers'
import { promotedTagsQuerySchema, parseSearchParams } from '@/lib/api/validation'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const parsed = parseSearchParams(searchParams, promotedTagsQuerySchema)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 }
    )
  }

  const { threshold, limit } = parsed.data as { threshold?: number; limit?: number }

  try {
    const client = getSupabaseServerClient()
    const data = await queryPromotedTags(client, { threshold, limit })

    return NextResponse.json({
      success: true,
      data: data.map(transformTag),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
