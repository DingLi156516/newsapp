import type { PipelineBacklog } from '@/lib/pipeline/backlog'
import type { ClusterResult } from '@/lib/ai/clustering'
import type { AssemblyResult } from '@/lib/ai/story-assembler'
import type { EmbeddingResult } from '@/lib/ai/embeddings'

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
  | 'budget_reserved_for_downstream'
  | 'time_budget_exhausted'
  | 'no_progress'

interface StageExecutionMeta {
  readonly passes: number
  readonly skipped: boolean
  readonly skipReason: ProcessStageSkipReason | null
}

export interface ProcessPipelineSummary {
  readonly embeddings: EmbeddingResult & StageExecutionMeta
  readonly clustering: ClusterResult & StageExecutionMeta
  readonly assembly: AssemblyResult & StageExecutionMeta
  readonly backlog: {
    readonly before: PipelineBacklog
    readonly after: PipelineBacklog
  }
}

interface MutableEmbeddingSummary {
  totalProcessed: number
  claimedArticles: number
  errors: string[]
  passes: number
  firstSkipReason: ProcessStageSkipReason | null
}

interface MutableClusteringSummary {
  newStories: number
  updatedStories: number
  assignedArticles: number
  unmatchedSingletons: number
  promotedSingletons: number
  expiredArticles: number
  errors: string[]
  passes: number
  firstSkipReason: ProcessStageSkipReason | null
}

interface MutableAssemblySummary {
  storiesProcessed: number
  claimedStories: number
  autoPublished: number
  sentToReview: number
  errors: string[]
  passes: number
  firstSkipReason: ProcessStageSkipReason | null
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

function markInitialSkipReason<T extends { passes: number; firstSkipReason: ProcessStageSkipReason | null }>(
  summary: T,
  reason: ProcessStageSkipReason
) {
  if (summary.passes === 0 && summary.firstSkipReason === null) {
    summary.firstSkipReason = reason
  }
}

function clusterMadeProgress(result: ClusterResult): boolean {
  return result.assignedArticles > 0
}

function finalizeStageMeta<T extends { passes: number; firstSkipReason: ProcessStageSkipReason | null }>(
  summary: T
): StageExecutionMeta {
  return {
    passes: summary.passes,
    skipped: summary.passes === 0,
    skipReason: summary.passes === 0 ? summary.firstSkipReason : null,
  }
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
  }

  const assembly: MutableAssemblySummary = {
    storiesProcessed: 0,
    claimedStories: 0,
    autoPublished: 0,
    sentToReview: 0,
    errors: [],
    passes: 0,
    firstSkipReason: null,
  }

  let currentBacklog = backlogBefore

  while (hasBudget(startMs, now, resolved.timeBudgetMs)) {
    let roundProgress = false

    if (assembly.storiesProcessed < resolved.assembleTarget) {
      const remainingBudgetMs = getRemainingBudgetMs(startMs, now, resolved.timeBudgetMs)
      if (currentBacklog.pendingAssemblyStories <= 0) {
        markInitialSkipReason(assembly, 'no_backlog')
      } else if (remainingBudgetMs <= resolved.assembleReserveMs) {
        markInitialSkipReason(assembly, 'time_budget_exhausted')
      } else {
        assembly.passes += 1
        const result = await runStep(`assemble_pass_${assembly.passes}`, () =>
          deps.assemble(Math.min(resolved.assembleBatchSize, resolved.assembleTarget - assembly.storiesProcessed))
        )
        assembly.storiesProcessed += result.storiesProcessed
        assembly.claimedStories += result.claimedStories
        assembly.autoPublished += result.autoPublished
        assembly.sentToReview += result.sentToReview
        assembly.errors = [...assembly.errors, ...result.errors]

        if (result.storiesProcessed > 0) {
          roundProgress = true
        }
      }
    }

    if (clustering.assignedArticles < resolved.clusterTarget) {
      const remainingBudgetMs = getRemainingBudgetMs(startMs, now, resolved.timeBudgetMs)
      const requiredBudgetMs = resolved.clusterReserveMs +
        (currentBacklog.pendingAssemblyStories > 0 ? resolved.assembleReserveMs : 0)
      if (currentBacklog.unclusteredArticles <= 0) {
        markInitialSkipReason(clustering, 'no_backlog')
      } else if (remainingBudgetMs <= requiredBudgetMs) {
        markInitialSkipReason(clustering, 'time_budget_exhausted')
      } else {
        clustering.passes += 1
        const result = await runStep(`cluster_pass_${clustering.passes}`, () =>
          deps.cluster(Math.min(resolved.clusterBatchSize, resolved.clusterTarget - clustering.assignedArticles))
        )
        clustering.newStories += result.newStories
        clustering.updatedStories += result.updatedStories
        clustering.assignedArticles += result.assignedArticles
        clustering.unmatchedSingletons += result.unmatchedSingletons
        clustering.promotedSingletons += result.promotedSingletons
        clustering.expiredArticles += result.expiredArticles
        clustering.errors = [...clustering.errors, ...result.errors]

        if (clusterMadeProgress(result)) {
          roundProgress = true
          currentBacklog = await deps.countBacklog()
        }
      }
    }

    if (embeddings.totalProcessed < resolved.embedTarget) {
      const remainingBudgetMs = getRemainingBudgetMs(startMs, now, resolved.timeBudgetMs)
      if (currentBacklog.unembeddedArticles <= 0) {
        markInitialSkipReason(embeddings, 'no_backlog')
      } else if (remainingBudgetMs <= 0) {
        markInitialSkipReason(embeddings, 'time_budget_exhausted')
      } else if (remainingBudgetMs <= getEmbedReserveMs(currentBacklog, resolved)) {
        markInitialSkipReason(embeddings, 'budget_reserved_for_downstream')
      } else {
        embeddings.passes += 1
        const result = await runStep(`embed_pass_${embeddings.passes}`, () =>
          deps.embed(Math.min(resolved.embedBatchSize, resolved.embedTarget - embeddings.totalProcessed))
        )
        embeddings.totalProcessed += result.totalProcessed
        embeddings.claimedArticles += result.claimedArticles
        embeddings.errors = [...embeddings.errors, ...result.errors]

        if (result.totalProcessed > 0) {
          roundProgress = true
        }
      }
    }

    if (!roundProgress) {
      if (!hasBudget(startMs, now, resolved.timeBudgetMs)) {
        markInitialSkipReason(assembly, 'time_budget_exhausted')
        markInitialSkipReason(clustering, 'time_budget_exhausted')
        markInitialSkipReason(embeddings, 'time_budget_exhausted')
      } else {
        markInitialSkipReason(assembly, 'no_progress')
        markInitialSkipReason(clustering, 'no_progress')
        markInitialSkipReason(embeddings, 'no_progress')
      }
      break
    }

    currentBacklog = await deps.countBacklog()
  }

  return {
    embeddings: {
      totalProcessed: embeddings.totalProcessed,
      claimedArticles: embeddings.claimedArticles,
      errors: embeddings.errors,
      ...finalizeStageMeta(embeddings),
    },
    clustering: {
      newStories: clustering.newStories,
      updatedStories: clustering.updatedStories,
      assignedArticles: clustering.assignedArticles,
      unmatchedSingletons: clustering.unmatchedSingletons,
      promotedSingletons: clustering.promotedSingletons,
      expiredArticles: clustering.expiredArticles,
      errors: clustering.errors,
      ...finalizeStageMeta(clustering),
    },
    assembly: {
      storiesProcessed: assembly.storiesProcessed,
      claimedStories: assembly.claimedStories,
      autoPublished: assembly.autoPublished,
      sentToReview: assembly.sentToReview,
      errors: assembly.errors,
      ...finalizeStageMeta(assembly),
    },
    backlog: {
      before: backlogBefore,
      after: currentBacklog,
    },
  }
}
