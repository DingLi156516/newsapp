/**
 * app/api/cron/refresh-trending/route.ts — Trending-score refresh cron.
 *
 * Calls the `refresh_trending_scores()` SQL function (migration 050) to:
 *   1. Recompute `stories.trending_score` across the 7-day published window
 *      so the stored time-decay term tracks wall-clock time.
 *   2. Null out scores on rows that have aged out of the window or lost
 *      `published` status, keeping `idx_stories_trending_score` bounded.
 *
 * Decoupled from `/api/cron/process` because refresh is an unbounded UPDATE
 * over the active set and must not share budget with the ingest/assembly
 * runner (300s route limit). Scheduling cadence is the trending feed
 * freshness SLA — recommend every 15 min via external scheduler.
 *
 * Also does the first post-deploy backfill (migration 050 intentionally does
 * not populate `trending_score` inline to avoid blocking schema deploy on a
 * large write transaction).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = getSupabaseServiceClient()
  const started = Date.now()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc('refresh_trending_scores')
  const durationMs = Date.now() - started

  if (error) {
    console.warn('[cron/refresh-trending] RPC failed:', error.message)
    return NextResponse.json(
      { success: false, error: error.message, durationMs },
      { status: 500 }
    )
  }

  // The SQL function returns -1 when another refresh is already running
  // (advisory lock held). Surface this as a distinct "skipped" response so
  // cron logs show the concurrency guard firing rather than a silent no-op.
  const value = typeof data === 'number' ? data : 0
  const skipped = value === -1

  return NextResponse.json({
    success: true,
    data: {
      updated: skipped ? 0 : value,
      skipped,
      durationMs,
    },
  })
}
