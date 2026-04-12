/**
 * GET /api/owners — Media owner directory with type filter and search.
 *
 * Returns owners sorted by name ASC with source count.
 * Public — no auth required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { ownersQuerySchema } from '@/lib/api/owner-validation'
import type { OwnersQuery } from '@/lib/api/owner-validation'
import { queryOwners } from '@/lib/api/owner-queries'
import { transformOwner } from '@/lib/api/transformers'
import { parseSearchParams } from '@/lib/api/validation'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const parsed = parseSearchParams(searchParams, ownersQuerySchema)

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 }
    )
  }

  try {
    const client = getSupabaseServerClient()
    const params = parsed.data as OwnersQuery
    const { data, count } = await queryOwners(client, params)

    return NextResponse.json({
      success: true,
      data: data.map(transformOwner),
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
