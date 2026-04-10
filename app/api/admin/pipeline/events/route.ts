/**
 * app/api/admin/pipeline/events/route.ts — Pipeline stage event drill-down.
 *
 *   GET /api/admin/pipeline/events
 *     ?runId=<uuid>                  filter by run_id
 *     &stage=ingest|embed|cluster|assemble|recluster
 *     &level=debug|info|warn|error   comma-separated OK
 *     &limit=50                      default 50, max 500
 *     &offset=0                      default 0
 *
 * Closes Codex review finding #9 (MEDIUM) — gives operators a correlated
 * drill-down view of warn/error events during a specific pipeline run.
 *
 * Admin-only. Uses the service-role client because the
 * pipeline_stage_events RLS policy only grants access to service_role
 * (see migration 044). See docs/operations.md — "Investigating a
 * degraded run" for the runbook.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

const STAGE_VALUES = ['ingest', 'embed', 'cluster', 'assemble', 'recluster'] as const
const LEVEL_VALUES = ['debug', 'info', 'warn', 'error'] as const

const querySchema = z.object({
  runId: z.string().uuid().optional(),
  stage: z.enum(STAGE_VALUES).optional(),
  level: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      if (!raw) return undefined
      const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
      for (const part of parts) {
        if (!LEVEL_VALUES.includes(part as typeof LEVEL_VALUES[number])) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `invalid level: ${part}`,
          })
          return z.NEVER
        }
      }
      return parts as (typeof LEVEL_VALUES[number])[]
    }),
  limit: z
    .string()
    .optional()
    .transform((raw) => {
      const parsed = raw ? parseInt(raw, 10) : NaN
      if (Number.isNaN(parsed) || parsed <= 0) return 50
      return Math.min(parsed, 500)
    }),
  offset: z
    .string()
    .optional()
    .transform((raw) => {
      const parsed = raw ? parseInt(raw, 10) : NaN
      if (Number.isNaN(parsed) || parsed < 0) return 0
      return parsed
    }),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { user, isAdmin, error: authError } = await getAdminUser()

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

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid query',
      },
      { status: 400 }
    )
  }

  const { runId, stage, level, limit, offset } = parsed.data

  try {
    const client = getSupabaseServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = (client.from('pipeline_stage_events') as any)
      .select('*')
      .order('created_at', { ascending: false })

    if (runId) query = query.eq('run_id', runId)
    if (stage) query = query.eq('stage', stage)
    if (level && level.length > 0) query = query.in('level', level)

    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch stage events: ${error.message}`)
    }

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
