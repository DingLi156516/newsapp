/**
 * GET /api/tags — Tag directory with type filter and search.
 *
 * Returns tags sorted by story_count DESC. Supports `type`, `search`,
 * `page`, and `limit` query params.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { tagsQuerySchema, parseSearchParams } from '@/lib/api/validation'
import { queryTags } from '@/lib/api/query-helpers'
import { transformTag } from '@/lib/api/transformers'
import type { TagsQuery } from '@/lib/api/validation'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const parsed = parseSearchParams(searchParams, tagsQuerySchema)

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 }
    )
  }

  try {
    const client = getSupabaseServerClient()
    const params = parsed.data as TagsQuery
    const { data, count } = await queryTags(client, params)

    return NextResponse.json({
      success: true,
      data: data.map(transformTag),
      meta: {
        total: count,
        page: params.page,
        limit: params.limit,
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
