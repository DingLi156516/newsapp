/**
 * app/api/admin/pipeline/route.ts — Pipeline run history endpoint.
 *
 * Returns recent pipeline runs with steps and summaries.
 * Auth: admin only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/api/admin-helpers'

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

  const limitParam = request.nextUrl.searchParams.get('limit')
  const limit = Math.min(Math.max(parseInt(limitParam ?? '20', 10) || 20, 1), 100)
  // ?status=running lets the live banner find a long-stuck run without
  // depending on it being inside the most-recent <limit> rows.
  const statusParam = request.nextUrl.searchParams.get('status')
  const status = statusParam === 'running' || statusParam === 'completed' || statusParam === 'failed'
    ? statusParam
    : null

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = (supabase.from('pipeline_runs') as any)
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)
    if (status) query = query.eq('status', status)
    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch pipeline runs: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      data: data ?? [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
