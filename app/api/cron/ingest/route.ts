/**
 * app/api/cron/ingest/route.ts — RSS ingestion cron endpoint.
 *
 * Called every 15 minutes by Vercel Cron (or manually during development).
 * Authenticates via CRON_SECRET header, then runs the full ingestion pipeline.
 * Logs run details to pipeline_runs table via PipelineLogger.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { ingestAllSources } from '@/lib/ingestion/ingest'
import { PipelineLogger } from '@/lib/pipeline/logger'
import { toPerMinute } from '@/lib/pipeline/telemetry-utils'

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
  const logger = new PipelineLogger(client)

  try {
    await logger.startRun('ingest', 'cron')
    const result = await logger.logStep('ingest_all_sources', () =>
      ingestAllSources(client) as unknown as Promise<Record<string, unknown>>
    )
    const durationMs = logger.getSteps().find((step) => step.step === 'ingest_all_sources')?.duration_ms ?? 0
    const summary = {
      ...result,
      ingestedPerMinute: toPerMinute(Number((result as Record<string, unknown>).newArticles ?? 0), durationMs),
    }
    await logger.complete(summary)

    return NextResponse.json({
      success: true,
      data: { runId: logger.getRunId(), ...summary },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logger.fail(message).catch(() => {})
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
