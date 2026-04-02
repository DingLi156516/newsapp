import type { PipelineBacklog } from '@/lib/pipeline/backlog'
import type { ClusterResult } from '@/lib/ai/clustering'
import type { AssemblyResult } from '@/lib/ai/story-assembler'
import type { EmbeddingResult } from '@/lib/ai/embeddings'
import { toPerMinute } from '@/lib/pipeline/telemetry-utils'

interface StepLogger {
  <T>(step: string, fn: () => Promise<T>): Promise<T>
}

export interface ProcessPipelineDependencies {
  readonly countBacklog: () => Promise<PipelineBacklog>
  readonly embed: (maxArticles: number) => Promise<EmbeddingResult>
  readonly cluster: (maxArticles: number) => Promise<ClusterResult>
  readonly assemble: (maxStories: number) => Promise<AssemblyResult>
  readonly logStep?: StepLogger
  readonly now?: () => number
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

const DEFAULT_OPTIONS: Required<ProcessPipelineOptions> = {
  embedTarget: Number(process.env.PIPELINE_PROCESS_EMBED_TARGET ?? 1500),
  clusterTarget: Number(process.env.PIPELINE_PROCESS_CLUSTER_TARGET ?? 1500),
  assembleTarget: Number(process.env.PIPELINE_PROCESS_ASSEMBLE_TARGET ?? 100),
  embedBatchSize: Number(process.env.PIPELINE_PROCESS_EMBED_BATCH_SIZE ?? 50),
  clusterBatchSize: Number(process.env.PIPELINE_PROCESS_CLUSTER_BATCH_SIZE ?? 75),
  assembleBatchSize: Number(process.env.PIPELINE_PROCESS_ASSEMBLE_BATCH_SIZE ?? 25),
  timeBudgetMs: process.env.PIPELINE_PROCESS_TIME_BUDGET_MS
    ? Number(process.env.PIPELINE_PROCESS_TIME_BUDGET_MS)
    : Infinity,
  clusterReserveMs: Number(process.env.PIPELINE_PROCESS_CLUSTER_RESERVE_MS ?? 25_000),
  assembleReserveMs: Number(process.env.PIPELINE_PROCESS_ASSEMBLE_RESERVE_MS ?? 15_000),
}

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

  const backlogBefore = await deps.countBacklog()

  const embeddings: MutableEmbeddingSummary = {
    totalProcessed: 0,
    claimedArticles: 0,
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

  while (hasBudget(startMs, now, resolved.timeBudgetMs)) {
    let roundProgress = false

    if (embeddings.totalProcessed < resolved.embedTarget) {
      const remainingBudgetMs = getRemainingBudgetMs(startMs, now, resolved.timeBudgetMs)
      if (currentBacklog.unembeddedArticles <= 0) {
        markInitialSkipReason(embeddings, 'no_backlog')
      } else if (remainingBudgetMs <= 0) {
        markInitialSkipReason(embeddings, 'time_budget_exhausted')
      } else if (remainingBudgetMs <= getEmbedReserveMs(currentBacklog, resolved)) {
        markInitialSkipReason(embeddings, 'budget_reserved_for_freshness')
      } else {
        embeddings.passes += 1
        const result = await runMeasuredStep(
          runStep,
          now,
          embeddings,
          `embed_pass_${embeddings.passes}`,
          () => deps.embed(Math.min(resolved.embedBatchSize, resolved.embedTarget - embeddings.totalProcessed))
        )
        embeddings.totalProcessed += result.totalProcessed
        embeddings.claimedArticles += result.claimedArticles
        embeddings.errors = [...embeddings.errors, ...result.errors]

        if (result.totalProcessed > 0) {
          roundProgress = true
          currentBacklog = await deps.countBacklog()
        }
      }
    }

    if (clustering.assignedArticles < resolved.clusterTarget) {
      const remainingBudgetMs = getRemainingBudgetMs(startMs, now, resolved.timeBudgetMs)
      if (currentBacklog.unclusteredArticles <= 0) {
        markInitialSkipReason(clustering, 'no_backlog')
      } else if (remainingBudgetMs <= 0) {
        markInitialSkipReason(clustering, 'time_budget_exhausted')
      } else {
        clustering.passes += 1
        const result = await runMeasuredStep(
          runStep,
          now,
          clustering,
          `cluster_pass_${clustering.passes}`,
          () => deps.cluster(Math.min(resolved.clusterBatchSize, resolved.clusterTarget - clustering.assignedArticles))
        )
        clustering.newStories += result.newStories
        clustering.updatedStories += result.updatedStories
        clustering.assignedArticles += result.assignedArticles
        clustering.unmatchedSingletons += result.unmatchedSingletons
        clustering.promotedSingletons += result.promotedSingletons
        clustering.expiredArticles += result.expiredArticles
        clustering.errors = [...clustering.errors, ...result.errors]

        if (result.assignedArticles > 0 || result.expiredArticles > 0) {
          roundProgress = true
          currentBacklog = await deps.countBacklog()
        }
      }
    }

    if (assembly.storiesProcessed < resolved.assembleTarget) {
      const remainingBudgetMs = getRemainingBudgetMs(startMs, now, resolved.timeBudgetMs)
      if (currentBacklog.pendingAssemblyStories <= 0) {
        markInitialSkipReason(assembly, 'no_backlog')
      } else if (
        freshnessBacklogExists(currentBacklog) &&
        remainingBudgetMs <= resolved.assembleReserveMs + resolved.clusterReserveMs
      ) {
        markInitialSkipReason(assembly, 'budget_reserved_for_freshness')
      } else if (remainingBudgetMs <= 0) {
        markInitialSkipReason(assembly, 'time_budget_exhausted')
      } else {
        assembly.passes += 1
        const result = await runMeasuredStep(
          runStep,
          now,
          assembly,
          `assemble_pass_${assembly.passes}`,
          () => deps.assemble(Math.min(resolved.assembleBatchSize, resolved.assembleTarget - assembly.storiesProcessed))
        )
        assembly.storiesProcessed += result.storiesProcessed
        assembly.claimedStories += result.claimedStories
        assembly.autoPublished += result.autoPublished
        assembly.sentToReview += result.sentToReview
        assembly.cheapModelTasks += result.cheapModelTasks ?? 0
        assembly.cheapModelFallbacks += result.cheapModelFallbacks ?? 0
        assembly.summaryFallbacks += result.summaryFallbacks ?? 0
        assembly.errors = [...assembly.errors, ...result.errors]

        if (result.storiesProcessed > 0) {
          roundProgress = true
          currentBacklog = await deps.countBacklog()
        }
      }
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
    },
  }
}
