/**
 * app/api/admin/pipeline/snapshots/route.ts — backlog snapshot history.
 *
 *   GET /api/admin/pipeline/snapshots?hours=24
 *
 * Used by the sparkline tiles in PipelineSummaryStats.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { queryBacklogSnapshots } from '@/lib/api/pipeline-snapshots'

const querySchema = z.object({
  hours: z
    .string()
    .optional()
    .transform((raw) => {
      const parsed = raw ? parseInt(raw, 10) : NaN
      if (Number.isNaN(parsed) || parsed <= 0) return 24
      return Math.min(parsed, 14 * 24)
    }),
})

export async function GET(request: NextRequest) {
  const { user, isAdmin, error: authError } = await getAdminUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { hours } = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()))

  try {
    const client = getSupabaseServiceClient()
    const snapshots = await queryBacklogSnapshots(client, hours)
    return NextResponse.json({ success: true, data: { hours, snapshots } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
