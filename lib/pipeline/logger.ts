/**
 * lib/pipeline/logger.ts — Structured pipeline run logger.
 *
 * Accumulates step results during a pipeline run and persists them
 * to the pipeline_runs table. Each run tracks type, trigger source,
 * individual step timings/results, and final summary.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { StageEventEmitter, StageEventInput } from '@/lib/pipeline/stage-events'

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

  /**
   * Persist a structured stage event to `pipeline_stage_events`.
   *
   * BEST-EFFORT — never throws. A DB write failure here must not stall
   * the pipeline. See docs/architecture.md — Observability.
   */
  async stageEvent(
    runId: string,
    claimOwner: string | null,
    input: StageEventInput
  ): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (this.client.from('pipeline_stage_events') as any)
        .insert({
          run_id: runId,
          claim_owner: claimOwner,
          stage: input.stage,
          source_id: input.sourceId ?? null,
          provider: input.provider ?? null,
          level: input.level,
          event_type: input.eventType,
          item_id: input.itemId ?? null,
          duration_ms: input.durationMs ?? null,
          payload: input.payload ?? {},
        })
      if (error) {
        console.warn(`[logger] stageEvent persist failed: ${error.message}`)
      }
    } catch (err) {
      console.warn(
        `[logger] stageEvent threw: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  /**
   * Build an emitter pre-bound to a specific run_id + claim_owner.
   * Pass this into stage functions instead of manually plumbing IDs.
   *
   * `claimOwner` accepts `null` for maintenance jobs (e.g. the hourly
   * `/api/cron/recluster` route) that do not participate in the normal
   * claim-lease flow but still want to correlate their stage events to
   * a run/correlation UUID. Cron `process`/`ingest`/`full` entry points
   * pass the run's `generateClaimOwner()` UUID.
   */
  makeStageEmitter(runId: string, claimOwner: string | null): StageEventEmitter {
    return (event) => this.stageEvent(runId, claimOwner, event)
  }
}
