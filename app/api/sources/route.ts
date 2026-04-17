/**
 * GET /api/sources — Source directory with filters.
 *
 * Query params: bias, factuality, ownership, region, search, page, limit
 * Returns: { sources: NewsSource[], meta: { total, page, limit } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { sourcesQuerySchema, parseSearchParams } from '@/lib/api/validation'
import { querySources } from '@/lib/api/query-helpers'
import { transformSource } from '@/lib/api/transformers'
import type { DbSource, DbMediaOwner } from '@/lib/supabase/types'

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(
    request.nextUrl.searchParams,
    sourcesQuerySchema
  )

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 }
    )
  }

  try {
    const client = getSupabaseServerClient()
    const { data: sources, count, ownershipUnavailable } = await querySources(
      client,
      parsed.data as Parameters<typeof querySources>[1]
    )

    const transformed = sources.map((s) => {
      const row = s as DbSource & { owner?: DbMediaOwner | null }
      return transformSource(row, undefined, row.owner ?? undefined)
    })

    return NextResponse.json({
      success: true,
      data: transformed,
      meta: {
        total: count,
        page: parsed.data.page as number,
        limit: parsed.data.limit as number,
        ...(ownershipUnavailable ? { ownershipUnavailable: true } : {}),
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
