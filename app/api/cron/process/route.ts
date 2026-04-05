/**
 * app/api/cron/process/route.ts — AI processing cron endpoint.
 *
 * Runs the round-based embed → cluster → assemble process pipeline.
 * Called 5 minutes after ingestion (staggered schedule).
 * Logs run details to pipeline_runs table via PipelineLogger.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { embedUnembeddedArticles } from '@/lib/ai/embeddings'
import { clusterArticles } from '@/lib/ai/clustering'
import { assembleStories } from '@/lib/ai/story-assembler'
import { PipelineLogger } from '@/lib/pipeline/logger'
import { countPipelineBacklog } from '@/lib/pipeline/backlog'
import { runProcessPipeline } from '@/lib/pipeline/process-runner'

export const runtime = 'nodejs'
export const maxDuration = 300

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
    await logger.startRun('process', 'cron')
    const summary = await runProcessPipeline({
      countBacklog: () => countPipelineBacklog(client),
      embed: (maxArticles) => embedUnembeddedArticles(client, maxArticles),
      cluster: (maxArticles) => clusterArticles(client, maxArticles),
      assemble: (maxStories) => assembleStories(client, maxStories),
      logStep: <T,>(step: string, fn: () => Promise<T>) =>
        logger.logStep(step, () => fn() as unknown as Promise<Record<string, unknown>>) as Promise<T>,
    }, { timeBudgetMs: 280_000 })
    await logger.complete(summary as unknown as Record<string, unknown>)

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
