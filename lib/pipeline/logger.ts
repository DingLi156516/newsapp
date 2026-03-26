/**
 * lib/pipeline/logger.ts — Structured pipeline run logger.
 *
 * Accumulates step results during a pipeline run and persists them
 * to the pipeline_runs table. Each run tracks type, trigger source,
 * individual step timings/results, and final summary.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export type PipelineRunType = 'ingest' | 'process' | 'full'
export type PipelineStepStatus = 'success' | 'error' | 'skipped'

export interface PipelineStep {
  readonly step: string
  readonly status: PipelineStepStatus
  readonly duration_ms: number
  readonly result?: Record<string, unknown>
  readonly error?: string
}

export class PipelineLogger {
  private readonly client: SupabaseClient<Database>
  private runId: string | null = null
  private readonly steps: PipelineStep[] = []
  private startTime: number = 0

  constructor(client: SupabaseClient<Database>) {
    this.client = client
  }

  getRunId(): string | null {
    return this.runId
  }

  getSteps(): readonly PipelineStep[] {
    return this.steps
  }

  async startRun(type: PipelineRunType, triggeredBy: string): Promise<string> {
    this.startTime = Date.now()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.client.from('pipeline_runs') as any)
      .insert({
        run_type: type,
        triggered_by: triggeredBy,
        status: 'running',
      })
      .select('id')
      .single()

    if (error || !data) {
      throw new Error(`Failed to create pipeline run: ${error?.message ?? 'no data returned'}`)
    }

    this.runId = data.id as string
    return this.runId
  }

  async logStep<T extends Record<string, unknown>>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const stepStart = Date.now()

    try {
      const result = await fn()
      const step: PipelineStep = {
        step: name,
        status: 'success',
        duration_ms: Date.now() - stepStart,
        result: result as Record<string, unknown>,
      }
      this.steps.push(step)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const step: PipelineStep = {
        step: name,
        status: 'error',
        duration_ms: Date.now() - stepStart,
        error: message,
      }
      this.steps.push(step)
      throw err
    }
  }

  async complete(summary: Record<string, unknown>): Promise<void> {
    if (!this.runId) {
      throw new Error('Cannot complete a run that has not been started')
    }

    const durationMs = Date.now() - this.startTime

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.client.from('pipeline_runs') as any)
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        steps: this.steps,
        summary,
      })
      .eq('id', this.runId)
  }

  async fail(error: string): Promise<void> {
    if (!this.runId) {
      throw new Error('Cannot fail a run that has not been started')
    }

    const durationMs = Date.now() - this.startTime

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.client.from('pipeline_runs') as any)
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        steps: this.steps,
        error,
      })
      .eq('id', this.runId)
  }
}
