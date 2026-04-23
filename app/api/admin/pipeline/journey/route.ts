/**
 * app/api/admin/pipeline/journey/route.ts — operator paste lookup.
 *
 *   GET /api/admin/pipeline/journey?q=<url-or-uuid>
 *
 * Returns the article(s) + (optional) story journey state across the
 * full pipeline, plus correlated stage events and DLQ entries.
 * Admin-only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { resolveJourneyQuery } from '@/lib/api/pipeline-journey'

const querySchema = z.object({
  q: z.string().trim().min(1, 'q is required').max(2048),
})

export async function GET(request: NextRequest) {
  const { user, isAdmin, error: authError } = await getAdminUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid query' },
      { status: 400 }
    )
  }

  try {
    const client = getSupabaseServiceClient()
    const result = await resolveJourneyQuery(client, parsed.data.q)
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
