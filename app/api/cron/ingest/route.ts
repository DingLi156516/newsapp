/**
 * app/api/cron/ingest/route.ts — RSS ingestion cron endpoint.
 *
 * Called every 15 minutes by Vercel Cron (or manually during development).
 * Authenticates via CRON_SECRET header, then runs the full ingestion pipeline.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { ingestFeeds } from '@/lib/rss/ingest'

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
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const client = getSupabaseServiceClient()
    const result = await ingestFeeds(client)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
