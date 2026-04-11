import type { PipelineBacklog } from '@/lib/pipeline/backlog'
import type { ClusterResult } from '@/lib/ai/clustering'
import type { AssemblyResult } from '@/lib/ai/story-assembler'
import type { EmbeddingResult } from '@/lib/ai/embeddings'
import { toPerMinute } from '@/lib/pipeline/telemetry-utils'
import {
  recommendBatchSize,
  STAGE_BUDGETS,
  type StageKind as TunerStageKind,
  type StageRecommendation,
} from '@/lib/pipeline/batch-tuner'
import type { StageEventEmitter, StageEventInput } from '@/lib/pipeline/stage-events'
import { safeEmit } from '@/lib/pipeline/stage-events'

interface StepLogger {
  <T>(step: string, fn: () => Promise<T>): Promise<T>
}

/**
 * Optional per-stage recent-duration provider, used by the Phase 13A
 * batch tuner integration. The process runner calls this once at
 * startup to seed the tuner for each stage; if omitted (legacy callers)
 * each stage uses its static ceiling directly.
 *
 * Kept as an optional dependency so `process-runner.ts` stays pure and
 * does not reach into the Supabase client itself — the concrete
 * implementation lives in the cron route handlers.
 */
export interface StageDurationHistory {
  readonly embed: number[]
  readonly cluster: number[]
  readonly assemble: number[]
}

export interface ProcessPipelineDependencies {
  readonly countBacklog: () => Promise<PipelineBacklog>
  readonly embed: (maxArticles: number) => Promise<EmbeddingResult>
  readonly cluster: (maxArticles: number) => Promise<ClusterResult>
  readonly assemble: (maxStories: number) => Promise<AssemblyResult>
  readonly logStep?: StepLogger
  readonly now?: () => number
  /**
   * Best-effort recent-duration fetcher for the Phase 13A batch tuner.
   * Called once at the start of the run; if it throws or is omitted the
   * tuner is skipped and each stage falls back to its static ceiling.
   */
  readonly getStageDurations?: () => Promise<StageDurationHistory>
  /**
   * Optional structured stage-event emitter, used to record
   * `batch_tuner_recommendation` info events so operators can see the
   * tuner's decisions in the /admin/pipeline Events panel without
   * polluting `pipeline_runs.steps`.
   */
  readonly emitStageEvent?: StageEventEmitter
}

export interface ProcessPipelineOptions {
  readonly embedTarget?: number
  readonly clusterTarget?: number
  readonly assembleTarget?: number
  readonly embedBatchSize?: number
  readonly clusterBatchSize?: number
  readonly assembleBatchSize?: number
  readonly timeBudgetMs?: number
  readonly clusterReserveMs?: number
  readonly assembleReserveMs?: number
  readonly concurrentStages?: boolean
}

export type ProcessStageSkipReason =
  | 'no_backlog'
  | 'budget_reserved_for_freshness'
  | 'time_budget_exhausted'
  | 'no_progress'

interface StageExecutionMeta {
  readonly passes: number
  readonly skipped: boolean
  readonly skipReason: ProcessStageSkipReason | null
  readonly wallTimeMs: number
  readonly dbTimeMs: number
  readonly modelTimeMs: number
  readonly processedPerMinute: number
}

export interface ProcessPipelineTelemetry {
  readonly durationMs: number
  readonly processedPerMinute: number
  readonly concurrentMode: boolean
}

export interface ProcessPipelineSummary {
  readonly embeddings: EmbeddingResult & StageExecutionMeta
  readonly clustering: ClusterResult & StageExecutionMeta
  readonly assembly: AssemblyResult & StageExecutionMeta
  readonly backlog: {
    readonly before: PipelineBacklog
    readonly after: PipelineBacklog
  }
  readonly telemetry: ProcessPipelineTelemetry
}

interface MutableStageSummary {
  passes: number
  firstSkipReason: ProcessStageSkipReason | null
  wallTimeMs: number
  dbTimeMs: number
  modelTimeMs: number
}

interface MutableEmbeddingSummary extends MutableStageSummary {
  totalProcessed: number
  claimedArticles: number
  cacheHits: number
  errors: string[]
}

interface MutableClusteringSummary extends MutableStageSummary {
  newStories: number
  updatedStories: number
  assignedArticles: number
  unmatchedSingletons: number
  promotedSingletons: number
  expiredArticles: number
  errors: string[]
}

interface MutableAssemblySummary extends MutableStageSummary {
  storiesProcessed: number
  claimedStories: number
  autoPublished: number
  sentToReview: number
  cheapModelTasks: number
  cheapModelFallbacks: number
  summaryFallbacks: number
  errors: string[]
}

/**
 * Single source of truth for pipeline batch/target defaults. Docs must
 * reference these names rather than hard-coded numbers.
 *
 * The batch-size values are adaptive CEILINGS: per-run tuning in
 * `lib/pipeline/batch-tuner.ts` shrinks them when stage wall-time breaches
 * its budget and restores them when consistently under-budget. Env
 * variables set the ceiling, not the exact value.
 *
 * Targets are per-run work ceilings: a single run will not process more
 * than `embedTarget` articles, etc.
 */
export const PIPELINE_DEFAULTS: Required<ProcessPipelineOptions> = {
  embedTarget: Number(process.env.PIPELINE_PROCESS_EMBED_TARGET ?? 1500),
  clusterTarget: Number(process.env.PIPELINE_PROCESS_CLUSTER_TARGET ?? 1500),
  assembleTarget: Number(process.env.PIPELINE_PROCESS_ASSEMBLE_TARGET ?? 100),
  embedBatchSize: Number(process.env.PIPELINE_PROCESS_EMBED_BATCH_SIZE ?? 200),
  clusterBatchSize: Number(process.env.PIPELINE_PROCESS_CLUSTER_BATCH_SIZE ?? 300),
  assembleBatchSize: Number(process.env.PIPELINE_PROCESS_ASSEMBLE_BATCH_SIZE ?? 50),
  timeBudgetMs: process.env.PIPELINE_PROCESS_TIME_BUDGET_MS
    ? Number(process.env.PIPELINE_PROCESS_TIME_BUDGET_MS)
    : 280_000,
  clusterReserveMs: Number(process.env.PIPELINE_PROCESS_CLUSTER_RESERVE_MS ?? 25_000),
  assembleReserveMs: Number(process.env.PIPELINE_PROCESS_ASSEMBLE_RESERVE_MS ?? 15_000),
  concurrentStages: process.env.PIPELINE_CONCURRENT_STAGES === 'true',
}

const DEFAULT_OPTIONS = PIPELINE_DEFAULTS

function hasBudget(startMs: number, now: () => number, timeBudgetMs: number): boolean {
  return now() - startMs < timeBudgetMs
}

function getRemainingBudgetMs(startMs: number, now: () => number, timeBudgetMs: number): number {
  return timeBudgetMs - (now() - startMs)
}

function freshnessBacklogExists(backlog: PipelineBacklog): boolean {
  return backlog.unembeddedArticles > 0 || backlog.unclusteredArticles > 0
}

function getEmbedReserveMs(backlog: PipelineBacklog, options: Required<ProcessPipelineOptions>): number {
  let reserveMs = 0

  if (backlog.unclusteredArticles > 0) {
    reserveMs += options.clusterReserveMs
  }

  if (backlog.pendingAssemblyStories > 0) {
    reserveMs += options.assembleReserveMs
  }

  return reserveMs
}

function markInitialSkipReason(summary: MutableStageSummary, reason: ProcessStageSkipReason) {
  if (summary.passes === 0 && summary.firstSkipReason === null) {
    summary.firstSkipReason = reason
  }
}

function finalizeStageMeta(summary: MutableStageSummary, processedCount: number): StageExecutionMeta {
  return {
    passes: summary.passes,
    skipped: summary.passes === 0,
    skipReason: summary.passes === 0 ? summary.firstSkipReason : null,
    wallTimeMs: summary.wallTimeMs,
    dbTimeMs: summary.dbTimeMs,
    modelTimeMs: summary.modelTimeMs,
    processedPerMinute: toPerMinute(processedCount, summary.wallTimeMs),
  }
}

async function runMeasuredStep<T extends { dbTimeMs?: number; modelTimeMs?: number }>(
  runStep: <R>(step: string, fn: () => Promise<R>) => Promise<R>,
  now: () => number,
  summary: MutableStageSummary,
  step: string,
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = now()
  const result = await runStep(step, fn)
  summary.wallTimeMs += Math.max(0, now() - startedAt)
  summary.dbTimeMs += result.dbTimeMs ?? 0
  summary.modelTimeMs += result.modelTimeMs ?? 0
  return result
}

export async function runProcessPipeline(
  deps: ProcessPipelineDependencies,
  options: ProcessPipelineOptions = {}
): Promise<ProcessPipelineSummary> {
  const resolved = { ...DEFAULT_OPTIONS, ...options }
  const now = deps.now ?? Date.now
  const startMs = now()
  const runStep = async <T>(step: string, fn: () => Promise<T>): Promise<T> => {
    if (deps.logStep) {
      return deps.logStep(step, fn)
    }
    return fn()
  }

  // -------------------------------------------------------------------------
  // Phase 13A — adaptive batch sizing (tuner integration)
  //
  // Default each stage's effective batch to its static ceiling. When the
  // caller supplies `getStageDurations`, ask the tuner for a recommendation
  // per stage and use `min(recommendation, ceiling)` as the effective
  // per-pass batch size. The ceiling from `resolved` always wins.
  //
  // Failure-tolerant: if the provider throws or the emitter rejects, the
  // run continues with the static ceiling. Observability must never stall
  // a pipeline run.
  // -------------------------------------------------------------------------
  let effectiveEmbedBatch = resolved.embedBatchSize
  let effectiveClusterBatch = resolved.clusterBatchSize
  let effectiveAssembleBatch = resolved.assembleBatchSize

  if (deps.getStageDurations) {
    try {
      const history = await deps.getStageDurations()
      const stagesToTune: ReadonlyArray<{
        kind: TunerStageKind
        ceiling: number
        apply: (v: number) => void
      }> = [
        {
          kind: 'embed',
          ceiling: resolved.embedBatchSize,
          apply: (v) => {
            effectiveEmbedBatch = v
          },
        },
        {
          kind: 'cluster',
          ceiling: resolved.clusterBatchSize,
          apply: (v) => {
            effectiveClusterBatch = v
          },
        },
        {
          kind: 'assemble',
          ceiling: resolved.assembleBatchSize,
          apply: (v) => {
            effectiveAssembleBatch = v
          },
        },
      ]

      for (const stage of stagesToTune) {
        const durations = history[stage.kind] ?? []
        let recommendation: StageRecommendation
        try {
          recommendation = recommendBatchSize(
            stage.kind,
            durations,
            stage.ceiling,
            STAGE_BUDGETS[stage.kind]
          )
        } catch (err) {
          // Never fail the run on a tuner bug — keep static ceiling.
          console.warn(
            `[process-runner] batch-tuner threw for ${stage.kind}: ${
              err instanceof Error ? err.message : String(err)
            }`
          )
          continue
        }

        // Hard-cap at the caller's ceiling. The tuner's own ceiling lives
        // in STAGE_BUDGETS and is typically larger than what the caller
        // passes in, so we must re-clamp here.
        const effective = Math.min(recommendation.recommendedBatch, stage.ceiling)
        stage.apply(effective)

        if (deps.emitStageEvent) {
          const event: StageEventInput = {
            stage: stage.kind,
            level: 'info',
            eventType: 'batch_tuner_recommendation',
            payload: {
              stage: stage.kind,
              ema: recommendation.emaMs,
              reason: recommendation.reason,
              recommendedBatch: effective,
              ceiling: stage.ceiling,
              historyCount: durations.length,
            },
          }
          // Fire and forget — safeEmit never throws even if the underlying
          // emitter rejects. We intentionally do not await in parallel
          // because stage events are very small and best-effort.
          await safeEmit(deps.emitStageEvent, event)
        }
      }
    } catch (err) {
      // Provider failure (e.g. Supabase outage): log once and continue
      // with the static ceilings already set above.
      console.warn(
        `[process-runner] getStageDurations failed, using static ceilings: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }

  const backlogBefore = await deps.countBacklog()

  const embeddings: MutableEmbeddingSummary = {
    totalProcessed: 0,
    claimedArticles: 0,
    cacheHits: 0,
    errors: [],
    passes: 0,
    firstSkipReason: null,
    wallTimeMs: 0,
    dbTimeMs: 0,
    modelTimeMs: 0,
  }
  const clustering: MutableClusteringSummary = {
    newStories: 0,
    updatedStories: 0,
    assignedArticles: 0,
    unmatchedSingletons: 0,
    promotedSingletons: 0,
    expiredArticles: 0,
    errors: [],
    passes: 0,
    firstSkipReason: null,
    wallTimeMs: 0,
    dbTimeMs: 0,
    modelTimeMs: 0,
  }
  const assembly: MutableAssemblySummary = {
    storiesProcessed: 0,
    claimedStories: 0,
    autoPublished: 0,
    sentToReview: 0,
    cheapModelTasks: 0,
    cheapModelFallbacks: 0,
    summaryFallbacks: 0,
    errors: [],
    passes: 0,
    firstSkipReason: null,
    wallTimeMs: 0,
    dbTimeMs: 0,
    modelTimeMs: 0,
  }

  let currentBacklog = backlogBefore

  async function runEmbedPass(): Promise<boolean> {
    if (embeddings.totalProcessed >= resolved.embedTarget) return false
    const remainingBudgetMs = getRemainingBudgetMs(startMs, now, resolved.timeBudgetMs)
    if (currentBacklog.unembeddedArticles <= 0) {
      markInitialSkipReason(embeddings, 'no_backlog')
      return false
    }
    if (remainingBudgetMs <= 0) {
      markInitialSkipReason(embeddings, 'time_budget_exhausted')
      return false
    }
    if (!resolved.concurrentStages && remainingBudgetMs <= getEmbedReserveMs(currentBacklog, resolved)) {
      markInitialSkipReason(embeddings, 'budget_reserved_for_freshness')
      return false
    }
    embeddings.passes += 1
    const result = await runMeasuredStep(
      runStep,
      now,
      embeddings,
      `embed_pass_${embeddings.passes}`,
      () => deps.embed(Math.min(effectiveEmbedBatch, resolved.embedTarget - embeddings.totalProcessed))
    )
    embeddings.totalProcessed += result.totalProcessed
    embeddings.claimedArticles += result.claimedArticles
    embeddings.cacheHits += result.cacheHits ?? 0
    embeddings.errors = [...embeddings.errors, ...result.errors]
    return result.totalProcessed > 0
  }

  async function runClusterPass(): Promise<boolean> {
    if (clustering.assignedArticles >= resolved.clusterTarget) return false
    const remainingBudgetMs = getRemainingBudgetMs(startMs, now, resolved.timeBudgetMs)
    if (currentBacklog.unclusteredArticles <= 0) {
      markInitialSkipReason(clustering, 'no_backlog')
      return false
    }
    if (remainingBudgetMs <= 0) {
      markInitialSkipReason(clustering, 'time_budget_exhausted')
      return false
    }
    clustering.passes += 1
    const result = await runMeasuredStep(
      runStep,
      now,
      clustering,
      `cluster_pass_${clustering.passes}`,
      () => deps.cluster(Math.min(effectiveClusterBatch, resolved.clusterTarget - clustering.assignedArticles))
    )
    clustering.newStories += result.newStories
    clustering.updatedStories += result.updatedStories
    clustering.assignedArticles += result.assignedArticles
    clustering.unmatchedSingletons += result.unmatchedSingletons
    clustering.promotedSingletons += result.promotedSingletons
    clustering.expiredArticles += result.expiredArticles
    clustering.errors = [...clustering.errors, ...result.errors]
    return result.assignedArticles > 0 || result.expiredArticles > 0
  }

  async function runAssemblePass(): Promise<boolean> {
    if (assembly.storiesProcessed >= resolved.assembleTarget) return false
    const remainingBudgetMs = getRemainingBudgetMs(startMs, now, resolved.timeBudgetMs)
    if (currentBacklog.pendingAssemblyStories <= 0) {
      markInitialSkipReason(assembly, 'no_backlog')
      return false
    }
    if (
      freshnessBacklogExists(currentBacklog) &&
      remainingBudgetMs <= resolved.assembleReserveMs + resolved.clusterReserveMs
    ) {
      markInitialSkipReason(assembly, 'budget_reserved_for_freshness')
      return false
    }
    if (remainingBudgetMs <= 0) {
      markInitialSkipReason(assembly, 'time_budget_exhausted')
      return false
    }
    assembly.passes += 1
    const result = await runMeasuredStep(
      runStep,
      now,
      assembly,
      `assemble_pass_${assembly.passes}`,
      () => deps.assemble(Math.min(effectiveAssembleBatch, resolved.assembleTarget - assembly.storiesProcessed))
    )
    assembly.storiesProcessed += result.storiesProcessed
    assembly.claimedStories += result.claimedStories
    assembly.autoPublished += result.autoPublished
    assembly.sentToReview += result.sentToReview
    assembly.cheapModelTasks += result.cheapModelTasks ?? 0
    assembly.cheapModelFallbacks += result.cheapModelFallbacks ?? 0
    assembly.summaryFallbacks += result.summaryFallbacks ?? 0
    assembly.errors = [...assembly.errors, ...result.errors]
    return result.storiesProcessed > 0
  }

  while (hasBudget(startMs, now, resolved.timeBudgetMs)) {
    let roundProgress = false

    if (resolved.concurrentStages) {
      const [embedProgress, clusterProgress] = await Promise.all([
        runEmbedPass(),
        runClusterPass(),
      ])
      if (embedProgress || clusterProgress) {
        currentBacklog = await deps.countBacklog()
      }
      const assemblyProgress = await runAssemblePass()
      if (assemblyProgress) {
        currentBacklog = await deps.countBacklog()
      }
      roundProgress = embedProgress || clusterProgress || assemblyProgress
    } else {
      const embedProgress = await runEmbedPass()
      if (embedProgress) {
        currentBacklog = await deps.countBacklog()
      }

      const clusterProgress = await runClusterPass()
      if (clusterProgress) {
        currentBacklog = await deps.countBacklog()
      }

      const assemblyProgress = await runAssemblePass()
      if (assemblyProgress) {
        currentBacklog = await deps.countBacklog()
      }

      roundProgress = embedProgress || clusterProgress || assemblyProgress
    }

    if (!roundProgress) {
      if (!hasBudget(startMs, now, resolved.timeBudgetMs)) {
        markInitialSkipReason(embeddings, 'time_budget_exhausted')
        markInitialSkipReason(clustering, 'time_budget_exhausted')
        markInitialSkipReason(assembly, 'time_budget_exhausted')
      } else {
        markInitialSkipReason(embeddings, 'no_progress')
        markInitialSkipReason(clustering, 'no_progress')
        markInitialSkipReason(assembly, 'no_progress')
      }
      break
    }
  }

  const durationMs = Math.max(0, now() - startMs)
  const totalProcessed = embeddings.totalProcessed + clustering.assignedArticles + assembly.storiesProcessed

  return {
    embeddings: {
      totalProcessed: embeddings.totalProcessed,
      claimedArticles: embeddings.claimedArticles,
      cacheHits: embeddings.cacheHits,
      errors: embeddings.errors,
      ...finalizeStageMeta(embeddings, embeddings.totalProcessed),
    },
    clustering: {
      newStories: clustering.newStories,
      updatedStories: clustering.updatedStories,
      assignedArticles: clustering.assignedArticles,
      unmatchedSingletons: clustering.unmatchedSingletons,
      promotedSingletons: clustering.promotedSingletons,
      expiredArticles: clustering.expiredArticles,
      errors: clustering.errors,
      ...finalizeStageMeta(clustering, clustering.assignedArticles),
    },
    assembly: {
      storiesProcessed: assembly.storiesProcessed,
      claimedStories: assembly.claimedStories,
      autoPublished: assembly.autoPublished,
      sentToReview: assembly.sentToReview,
      cheapModelTasks: assembly.cheapModelTasks,
      cheapModelFallbacks: assembly.cheapModelFallbacks,
      summaryFallbacks: assembly.summaryFallbacks,
      errors: assembly.errors,
      ...finalizeStageMeta(assembly, assembly.storiesProcessed),
    },
    backlog: {
      before: backlogBefore,
      after: currentBacklog,
    },
    telemetry: {
      durationMs,
      processedPerMinute: toPerMinute(totalProcessed, durationMs),
      concurrentMode: resolved.concurrentStages,
    },
  }
}
