/**
 * app/api/cron/recluster/route.ts — Re-clustering maintenance cron endpoint.
 *
 * Merges fragmented stories and ejects misassigned articles.
 * Schedule: hourly (configured in deployment platform).
 *
 * Observability: generates a correlation UUID per invocation and passes
 * a bound stage emitter into `reclusterRecentStories`, so warn/error
 * events (e.g. `pgvector_fallback`) during maintenance runs land in
 * `pipeline_stage_events` and can be drilled down in `/admin/pipeline`.
 * Recluster does not create a `pipeline_runs` row because its run_type
 * does not fit the existing `ingest|process|full` enum — operators can
 * still correlate via the returned `correlationId`.
 */

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { reclusterRecentStories } from '@/lib/ai/recluster'
import { PipelineLogger } from '@/lib/pipeline/logger'

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
  const correlationId = randomUUID()
  // No claim owner: recluster does not hold a pipeline claim lease.
  const emitter = logger.makeStageEmitter(correlationId, null)

  try {
    const result = await reclusterRecentStories(client, undefined, emitter)

    return NextResponse.json({
      success: true,
      correlationId,
      data: result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { success: false, correlationId, error: message },
      { status: 500 }
    )
  }
}
