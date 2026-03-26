/**
 * GET /api/stories — Paginated story feed with filtering.
 *
 * Query params: topic, region, perspective, search, blindspot, sort, page, limit
 * Returns: { stories: NewsArticle[], meta: { total, page, limit } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { storiesQuerySchema, parseSearchParams } from '@/lib/api/validation'
import { queryStories } from '@/lib/api/query-helpers'
import { transformStoryList } from '@/lib/api/transformers'

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(
    request.nextUrl.searchParams,
    storiesQuerySchema
  )

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 }
    )
  }

  try {
    const client = getSupabaseServerClient()
    const { data: stories, count } = await queryStories(
      client,
      parsed.data as Parameters<typeof queryStories>[1]
    )

    const transformed = stories.map(transformStoryList)

    return NextResponse.json({
      success: true,
      data: transformed,
      meta: {
        total: count,
        page: parsed.data.page as number,
        limit: parsed.data.limit as number,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
