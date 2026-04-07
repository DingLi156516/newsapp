/**
 * app/api/cron/recluster/route.ts — Re-clustering maintenance cron endpoint.
 *
 * Merges fragmented stories and ejects misassigned articles.
 * Schedule: hourly (configured in deployment platform).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { reclusterRecentStories } from '@/lib/ai/recluster'

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

  const client = getSupabaseServiceClient()

  try {
    const result = await reclusterRecentStories(client)

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
