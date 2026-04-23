'use client'

/**
 * components/organisms/PipelineActiveRunBanner.tsx — heartbeat banner
 * shown while any pipeline_run.status = 'running'.
 *
 * Polls /api/admin/pipeline?limit=5 every 2s via SWR refreshInterval.
 * The banner disappears as soon as no running rows are returned.
 *
 * Cancel control is stubbed (disabled button + tooltip): killing an
 * in-flight run requires careful handling of in-flight Gemini calls,
 * concurrent claim leases, and partial commits — out of scope here.
 */

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Loader2, Activity, XCircle } from 'lucide-react'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'
import { PipelineLiveFetchTicker } from '@/components/organisms/PipelineLiveFetchTicker'
import type { DbPipelineRun, DbPipelineStageEvent } from '@/lib/supabase/types'

interface RunsResponse {
  readonly success: boolean
  readonly data: DbPipelineRun[]
}

interface EventsResponse {
  readonly success: boolean
  readonly data: DbPipelineStageEvent[]
}

const POLL_MS = 2000

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${remainder}s`
}

export function PipelineActiveRunBanner() {
  const { user } = useAuth()

  // Filter on status=running so a long-stuck run that has fallen out of
  // the most-recent N rows still surfaces in the banner.
  const { data } = useSWR<RunsResponse>(
    user ? '/api/admin/pipeline?limit=5&status=running' : null,
    fetcher,
    { refreshInterval: POLL_MS, revalidateOnFocus: true }
  )

  const activeRun = data?.data[0]

  // pipeline_runs.steps is only persisted by PipelineLogger.complete()/.fail(),
  // so a row with status='running' has steps=[] for the entire run. Derive
  // the current stage from the latest stage event instead, which is written
  // immediately by the emitter.
  const { data: eventsData } = useSWR<EventsResponse>(
    activeRun ? `/api/admin/pipeline/events?runId=${activeRun.id}&limit=1` : null,
    fetcher,
    { refreshInterval: POLL_MS, revalidateOnFocus: true, dedupingInterval: 1000 }
  )
  const latestEvent = eventsData?.data[0]

  // Local clock so the elapsed label ticks every second between polls.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!activeRun) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [activeRun])

  if (!activeRun) return null

  const startedMs = new Date(activeRun.started_at).getTime()
  const elapsedMs = Math.max(0, now - startedMs)
  // Prefer the latest stage event (live), then fall back to the persisted
  // steps[] (only populated on completion), then 'starting'.
  const currentStep =
    latestEvent
      ? `${latestEvent.stage}: ${latestEvent.event_type}`
      : activeRun.steps[activeRun.steps.length - 1]?.step ?? 'starting'

  const showTicker = activeRun.run_type === 'ingest' || activeRun.run_type === 'full'

  return (
    <div
      data-testid="pipeline-active-run-banner"
      className="glass-sm border border-blue-400/30 bg-blue-500/5 rounded-2xl px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/15 text-blue-300">
          <Loader2 size={16} className="animate-spin" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-white/90">
            <Activity size={12} className="text-blue-300" />
            <span className="glass-pill px-2 py-0.5 text-[11px] text-white/70">
              {activeRun.run_type}
            </span>
            <span className="text-white/50 text-xs">
              triggered by {activeRun.triggered_by}
            </span>
          </div>
          <div className="mt-1 text-xs text-white/70 font-mono truncate">
            step: {currentStep}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-blue-200" aria-label="elapsed">
            {formatElapsed(elapsedMs)}
          </span>
          <button
            type="button"
            disabled
            title="Cancelling in-flight runs is not implemented yet"
            className="glass-pill px-3 py-1 text-xs text-white/30 flex items-center gap-1 cursor-not-allowed"
          >
            <XCircle size={12} />
            cancel
          </button>
        </div>
      </div>
      {showTicker && <PipelineLiveFetchTicker runId={activeRun.id} />}
    </div>
  )
}
