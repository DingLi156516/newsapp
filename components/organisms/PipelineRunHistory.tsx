'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle, Loader2, Maximize2 } from 'lucide-react'
import { usePipelineRuns } from '@/lib/hooks/use-pipeline'
import { Skeleton } from '@/components/atoms/Skeleton'
import { PipelineRunDrawer } from '@/components/organisms/PipelineRunDrawer'
import type { DbPipelineRun, DbPipelineStep } from '@/lib/supabase/types'

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  completed: { icon: CheckCircle2, color: 'text-emerald-400' },
  failed: { icon: XCircle, color: 'text-red-400' },
  running: { icon: Loader2, color: 'text-blue-400' },
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '\u2014'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSkipReason(reason: string | null | undefined): string {
  if (!reason) return 'skipped'
  return reason.replaceAll('_', ' ')
}

function formatPassLabel(count: number): string {
  return `${count} ${count === 1 ? 'pass' : 'passes'}`
}

function StepRow({ step }: { readonly step: DbPipelineStep }) {
  const statusColor = step.status === 'success'
    ? 'text-emerald-400'
    : step.status === 'error'
    ? 'text-red-400'
    : 'text-white/40'

  return (
    <div className="flex items-center justify-between py-1.5 px-3 text-xs">
      <div className="flex items-center gap-2">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${
          step.status === 'success' ? 'bg-emerald-400' : step.status === 'error' ? 'bg-red-400' : 'bg-white/30'
        }`} />
        <span className="text-white/70">{step.step}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={statusColor}>{step.status}</span>
        <span className="text-white/40 tabular-nums">{formatDuration(step.duration_ms)}</span>
      </div>
    </div>
  )
}

function getNum(obj: Record<string, unknown> | null, key: string): number | null {
  if (!obj || typeof obj[key] !== 'number') return null
  return obj[key] as number
}

function InlineRunMetrics({ run }: { readonly run: DbPipelineRun }) {
  const summary = run.summary ?? {}
  const ingest = typeof summary.ingest === 'object' && summary.ingest
    ? summary.ingest as Record<string, unknown>
    : null
  const assembly = typeof summary.assembly === 'object' && summary.assembly
    ? summary.assembly as Record<string, unknown>
    : null
  const clustering = typeof summary.clustering === 'object' && summary.clustering
    ? summary.clustering as Record<string, unknown>
    : null

  const pills: string[] = []

  if (run.run_type === 'ingest' && ingest) {
    const newArticles = getNum(ingest, 'newArticles')
    const successfulFeeds = getNum(ingest, 'successfulFeeds')
    const totalFeeds = getNum(ingest, 'totalFeeds')
    if (newArticles !== null) pills.push(`${newArticles} ingested`)
    if (successfulFeeds !== null && totalFeeds !== null) pills.push(`${successfulFeeds}/${totalFeeds} feeds`)
  }

  if (run.run_type === 'process' || run.run_type === 'full') {
    const pub = getNum(assembly, 'autoPublished')
    const rev = getNum(assembly, 'sentToReview')
    const clustered = getNum(clustering, 'assignedArticles')
    if (pub !== null) pills.push(`${pub} pub`)
    if (rev !== null && rev > 0) pills.push(`${rev} rev`)
    if (clustered !== null && clustered > 0) pills.push(`${clustered} clustered`)
  }

  if (pills.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-white/40">
      {pills.map((pill, i) => (
        <span key={i}>
          {i > 0 && <span className="mr-1.5">·</span>}
          {pill}
        </span>
      ))}
    </div>
  )
}

function RunRow({
  run,
  onOpenDrawer,
}: {
  readonly run: DbPipelineRun
  readonly onOpenDrawer: (run: DbPipelineRun) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const config = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.running
  const StatusIcon = config.icon
  const summary = run.summary ?? {}
  const assemblySummary = typeof summary.assembly === 'object' && summary.assembly
    ? summary.assembly as Record<string, unknown>
    : null
  const embeddingsSummary = typeof summary.embeddings === 'object' && summary.embeddings
    ? summary.embeddings as Record<string, unknown>
    : null
  const clusteringSummary = typeof summary.clustering === 'object' && summary.clustering
    ? summary.clustering as Record<string, unknown>
    : null
  const backlogSummary = typeof summary.backlog === 'object' && summary.backlog
    ? summary.backlog as Record<string, unknown>
    : null

  const stageSummaries = [
    { label: 'embeddings', value: embeddingsSummary },
    { label: 'clustering', value: clusteringSummary },
    { label: 'assembly', value: assemblySummary },
  ].filter((entry) => entry.value)

  return (
    <div className="glass-sm overflow-hidden">
      <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
        <button
          type="button"
          aria-label={expanded ? 'Collapse run summary' : 'Expand run summary'}
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-3 flex-1 text-left"
        >
          {expanded ? (
            <ChevronDown size={14} className="text-white/40" />
          ) : (
            <ChevronRight size={14} className="text-white/40" />
          )}
          <span className="glass-pill px-2 py-0.5 text-xs text-white/70">
            {run.run_type}
          </span>
          <span className="text-xs text-white/50">{run.triggered_by}</span>
        </button>
        <div className="flex items-center gap-4">
          <InlineRunMetrics run={run} />
          <div className={`flex items-center gap-1.5 ${config.color}`}>
            <StatusIcon size={14} className={run.status === 'running' ? 'animate-spin' : ''} />
            <span className="text-xs">{run.status}</span>
          </div>
          <div className="flex items-center gap-1.5 text-white/40">
            <Clock size={12} />
            <span className="text-xs tabular-nums">{formatDuration(run.duration_ms)}</span>
          </div>
          <span className="text-xs text-white/40">{formatTime(run.started_at)}</span>
          <button
            type="button"
            aria-label="Open run detail"
            onClick={() => onOpenDrawer(run)}
            className="text-white/40 hover:text-white/80 p-1"
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/5 bg-white/[0.02] py-2">
          {backlogSummary && (
            <div className="px-3 pb-2 text-xs text-white/45">
              <span className="mr-3">backlog</span>
              {typeof (backlogSummary.before as Record<string, unknown> | undefined)?.unembeddedArticles === 'number' && (
                <span className="mr-3">
                  unembedded {(backlogSummary.before as Record<string, unknown>).unembeddedArticles as number}
                  {' -> '}
                  {((backlogSummary.after as Record<string, unknown> | undefined)?.unembeddedArticles as number | undefined) ?? 0}
                </span>
              )}
              {typeof (backlogSummary.before as Record<string, unknown> | undefined)?.unclusteredArticles === 'number' && (
                <span className="mr-3">
                  unclustered {(backlogSummary.before as Record<string, unknown>).unclusteredArticles as number}
                  {' -> '}
                  {((backlogSummary.after as Record<string, unknown> | undefined)?.unclusteredArticles as number | undefined) ?? 0}
                </span>
              )}
              {typeof (backlogSummary.before as Record<string, unknown> | undefined)?.pendingAssemblyStories === 'number' && (
                <span className="mr-3">
                  pending assembly {(backlogSummary.before as Record<string, unknown>).pendingAssemblyStories as number}
                  {' -> '}
                  {((backlogSummary.after as Record<string, unknown> | undefined)?.pendingAssemblyStories as number | undefined) ?? 0}
                </span>
              )}
              {typeof (backlogSummary.before as Record<string, unknown> | undefined)?.reviewQueueStories === 'number' && (
                <span>
                  review {(backlogSummary.before as Record<string, unknown>).reviewQueueStories as number}
                  {' -> '}
                  {((backlogSummary.after as Record<string, unknown> | undefined)?.reviewQueueStories as number | undefined) ?? 0}
                </span>
              )}
            </div>
          )}
          {stageSummaries.length > 0 && (
            <div className="px-3 pb-2 space-y-1 text-xs text-white/45">
              {stageSummaries.map(({ label, value }) => {
                const skipped = value?.skipped === true
                if (skipped) {
                  return (
                    <div key={label}>
                      {label} skipped: {formatSkipReason(value?.skipReason as string | null | undefined)}
                    </div>
                  )
                }

                if (typeof value?.passes === 'number') {
                  return (
                    <div key={label}>
                      {label} {formatPassLabel(value.passes as number)}
                    </div>
                  )
                }

                return null
              })}
            </div>
          )}
          {run.steps.length > 0 ? (
            run.steps.map((step, i) => <StepRow key={i} step={step} />)
          ) : (
            <p className="px-4 py-2 text-xs text-white/30">No step data</p>
          )}
          {run.error && (
            <div className="mx-3 mt-2 px-3 py-2 bg-red-500/10 rounded text-xs text-red-400">
              {run.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function PipelineRunHistory() {
  const { runs, isLoading } = usePipelineRuns()
  const [activeRun, setActiveRun] = useState<DbPipelineRun | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-[24px]" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2
        className="text-lg font-bold text-white"
        style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
      >
        Run History
      </h2>

      {runs.length === 0 ? (
        <div className="glass-sm px-4 py-8 text-center text-sm text-white/40">
          No pipeline runs recorded yet
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <RunRow key={run.id} run={run} onOpenDrawer={setActiveRun} />
          ))}
        </div>
      )}
      {activeRun && (
        <PipelineRunDrawer run={activeRun} onClose={() => setActiveRun(null)} />
      )}
    </div>
  )
}
