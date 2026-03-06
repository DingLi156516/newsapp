import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { queryReviewQueue } from '@/lib/api/review-queries'
import { reviewQueueQuerySchema, type ReviewQueueQuery } from '@/lib/api/review-validation'
import { parseSearchParams } from '@/lib/api/validation'

export async function GET(request: NextRequest) {
  const { user, isAdmin, error: authError, supabase } = await getAdminUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 }
    )
  }

  const parsed = parseSearchParams(
    request.nextUrl.searchParams,
    reviewQueueQuerySchema
  )

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 }
    )
  }

  const params = parsed.data as unknown as ReviewQueueQuery

  try {
    const { data, count } = await queryReviewQueue(supabase, params)

    return NextResponse.json({
      success: true,
      data,
      meta: { total: count, page: params.page, limit: params.limit },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
