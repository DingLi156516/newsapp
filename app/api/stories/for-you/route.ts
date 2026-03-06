/**
 * GET /api/stories/for-you — Personalized "For You" feed.
 *
 * Requires authentication. Returns ranked stories based on user preferences,
 * reading history, and bias profile. Falls back to 401 for unauthenticated users.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { forYouQuerySchema, parseSearchParams } from '@/lib/api/validation'
import { queryForYouStories } from '@/lib/api/for-you-queries'
import type { ForYouQuery } from '@/lib/api/validation'

export async function GET(request: NextRequest) {
  const { user, error: authError, supabase } = await getAuthenticatedUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const parsed = parseSearchParams(request.nextUrl.searchParams, forYouQuerySchema)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      )
    }

    const params = parsed.data as ForYouQuery
    const { data, count } = await queryForYouStories(supabase, user.id, params)

    return NextResponse.json({
      success: true,
      data,
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
