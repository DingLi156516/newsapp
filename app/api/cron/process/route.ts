/**
 * app/api/cron/process/route.ts — AI processing cron endpoint.
 *
 * Runs the embed → cluster → assemble pipeline.
 * Called 5 minutes after ingestion (staggered schedule).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { embedUnembeddedArticles } from '@/lib/ai/embeddings'
import { clusterArticles } from '@/lib/ai/clustering'
import { assembleStories } from '@/lib/ai/story-assembler'

export const runtime = 'nodejs'
export const maxDuration = 120

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

    const embeddingResult = await embedUnembeddedArticles(client)
    const clusterResult = await clusterArticles(client)
    const assemblyResult = await assembleStories(client)

    return NextResponse.json({
      success: true,
      data: {
        embeddings: embeddingResult,
        clustering: clusterResult,
        assembly: assemblyResult,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
