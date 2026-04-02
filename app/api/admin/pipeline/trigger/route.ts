/**
 * app/api/admin/pipeline/trigger/route.ts — Pipeline trigger endpoint.
 *
 * Triggers an ingest, process, or full pipeline run.
 * Auth: admin only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { PipelineLogger } from '@/lib/pipeline/logger'
import { ingestFeeds } from '@/lib/rss/ingest'
import { embedUnembeddedArticles } from '@/lib/ai/embeddings'
import { clusterArticles } from '@/lib/ai/clustering'
import { assembleStories } from '@/lib/ai/story-assembler'
import { z } from 'zod'
import { countPipelineBacklog } from '@/lib/pipeline/backlog'
import { runProcessPipeline } from '@/lib/pipeline/process-runner'

const triggerSchema = z.object({
  type: z.enum(['ingest', 'process', 'full']),
})

function getStepDurationMs(
  logger: PipelineLogger,
  stepName: string
): number {
  return logger.getSteps().find((step) => step.step === stepName)?.duration_ms ?? 0
}

function toPerMinute(total: number, durationMs: number): number {
  if (total <= 0 || durationMs <= 0) {
    return 0
  }

  return Number(((total / durationMs) * 60_000).toFixed(2))
}

export async function POST(request: NextRequest) {
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parsed = triggerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { type } = parsed.data
  const serviceClient = getSupabaseServiceClient()
  const logger = new PipelineLogger(serviceClient)
  let ingestSummary: Record<string, unknown> | null = null

  try {
    await logger.startRun(type, `admin:${user.id}`)
    const backlogBefore = await countPipelineBacklog(serviceClient)

    if (type === 'ingest' || type === 'full') {
      const ingestResult = await logger.logStep('ingest_feeds', () =>
        ingestFeeds(serviceClient) as unknown as Promise<Record<string, unknown>>
      )
      ingestSummary = {
        ...ingestResult,
        ingestedPerMinute: toPerMinute(
          Number((ingestResult as Record<string, unknown>).newArticles ?? 0),
          getStepDurationMs(logger, 'ingest_feeds')
        ),
      }

      if (type === 'ingest') {
        const summary = {
          ingest: ingestSummary,
          backlog: { before: backlogBefore, after: await countPipelineBacklog(serviceClient) },
        }
        await logger.complete(summary)
        return NextResponse.json({ success: true, data: { runId: logger.getRunId(), ...summary } })
      }
    }

    if (type === 'process' || type === 'full') {
      const processSummary = await runProcessPipeline({
        countBacklog: () => countPipelineBacklog(serviceClient),
        embed: (maxArticles) => embedUnembeddedArticles(serviceClient, maxArticles),
        cluster: (maxArticles) => clusterArticles(serviceClient, maxArticles),
        assemble: (maxStories) => assembleStories(serviceClient, maxStories),
        logStep: <T,>(step: string, fn: () => Promise<T>) =>
          logger.logStep(step, () => fn() as unknown as Promise<Record<string, unknown>>) as Promise<T>,
      })
      const summary = ingestSummary ? { ingest: ingestSummary, ...processSummary } : processSummary
      await logger.complete(summary as unknown as Record<string, unknown>)
      return NextResponse.json({ success: true, data: { runId: logger.getRunId(), ...summary } })
    }

    await logger.complete({})
    return NextResponse.json({ success: true, data: { runId: logger.getRunId() } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logger.fail(message).catch(() => {})
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
