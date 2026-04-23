/**
 * app/api/admin/pipeline/top-errors/route.ts — top warn/error
 * signatures over a recent window.
 *
 *   GET /api/admin/pipeline/top-errors?window=24
 *
 * Window is in hours (1–168, default 24). Aggregates server-side so
 * the client receives only the grouped rows.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { queryTopErrors } from '@/lib/api/pipeline-top-errors'

const querySchema = z.object({
  window: z
    .string()
    .optional()
    .transform((raw) => {
      const parsed = raw ? parseInt(raw, 10) : NaN
      if (Number.isNaN(parsed) || parsed <= 0) return 24
      return Math.min(parsed, 168)
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

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const { window } = querySchema.parse(params)

  try {
    const client = getSupabaseServiceClient()
    const rows = await queryTopErrors(client, window)
    return NextResponse.json({ success: true, data: { windowHours: window, errors: rows } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
