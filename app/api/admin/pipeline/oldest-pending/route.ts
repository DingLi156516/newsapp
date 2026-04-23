/**
 * app/api/admin/pipeline/oldest-pending/route.ts — SLO snapshot endpoint.
 *
 *   GET /api/admin/pipeline/oldest-pending
 *
 * Returns the oldest pending row per stage (embed/cluster/assembly),
 * stale claim counts, and the review-queue reason breakdown. One
 * endpoint to keep the client surface small and the SWR key stable.
 *
 * Admin-only.
 */

import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import {
  queryOldestPendingByStage,
  queryStaleClaimCounts,
  queryReviewReasonBreakdown,
} from '@/lib/api/pipeline-oldest-pending'

export async function GET() {
  const { user, isAdmin, error: authError } = await getAdminUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const client = getSupabaseServiceClient()
    const [oldest, stale, reasons] = await Promise.all([
      queryOldestPendingByStage(client),
      queryStaleClaimCounts(client),
      queryReviewReasonBreakdown(client),
    ])

    return NextResponse.json({
      success: true,
      data: {
        oldest,
        stale,
        reviewReasons: reasons,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
