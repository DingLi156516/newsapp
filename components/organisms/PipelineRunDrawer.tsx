'use client'

/**
 * components/organisms/PipelineRunDrawer.tsx — slide-over panel that
 * shows a run's full step timeline, summary JSON, and the stage events
 * filtered to that run_id.
 *
 * Triggered by clicking a row in PipelineRunHistory.
 */

import { useMemo } from 'react'
import { X, CheckCircle2, XCircle, MinusCircle, Clock } from 'lucide-react'
import type { DbPipelineRun, DbPipelineStep } from '@/lib/supabase/types'
import { usePipelineEvents } from '@/lib/hooks/use-pipeline-events'

interface Props {
  readonly run: DbPipelineRun
  readonly onClose: () => void
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '\u2014'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function StepIcon({ status }: { readonly status: DbPipelineStep['status'] }) {
  if (status === 'success') return <CheckCircle2 size={14} className="text-emerald-400" />
  if (status === 'error') return <XCircle size={14} className="text-red-400" />
  return <MinusCircle size={14} className="text-white/40" />
}

function maxStepDuration(steps: readonly DbPipelineStep[]): number {
  let max = 0
  for (const s of steps) {
    if (s.duration_ms > max) max = s.duration_ms
  }
  return max
}

export function PipelineRunDrawer({ run, onClose }: Props) {
  const eventsFilter = useMemo(
    () => ({ runId: run.id, limit: 200 }),
    [run.id]
  )
  const { events, isLoading: eventsLoading } = usePipelineEvents(eventsFilter)

  const widest = maxStepDuration(run.steps)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pipeline run detail"
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        data-testid="pipeline-run-drawer"
        className="glass h-full w-full max-w-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/50">
              <span>{run.run_type}</span>
              <span>·</span>
              <span>{run.status}</span>
            </div>
            <div className="text-sm text-white/85 font-mono">
              {run.id.slice(0, 8)}…
            </div>
            <div className="text-[11px] text-white/40 flex items-center gap-2">
              <Clock size={10} />
              <span>{new Date(run.started_at).toLocaleString()}</span>
              <span>·</span>
              <span>{formatDuration(run.duration_ms)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-white/60 hover:text-white/90 p-1"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Step timeline (horizontal bars per step) */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-white/50 mb-2">
              Steps
            </h3>
            {run.steps.length === 0 ? (
              <p className="text-sm text-white/40">No step data recorded.</p>
            ) : (
              <ul className="space-y-1.5">
                {run.steps.map((step, i) => {
                  const widthPct = widest > 0
                    ? Math.max(2, (step.duration_ms / widest) * 100)
                    : 2
                  const barColor =
                    step.status === 'success'
                      ? 'bg-emerald-400/60'
                      : step.status === 'error'
                      ? 'bg-red-400/60'
                      : 'bg-white/20'
                  return (
                    <li key={i} className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <StepIcon status={step.status} />
                          <span className="text-white/80 font-mono">{step.step}</span>
                        </div>
                        <span className="text-white/40 tabular-nums">
                          {formatDuration(step.duration_ms)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full ${barColor}`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      {step.error && (
                        <div className="text-[11px] text-red-300/90 px-2 py-1 bg-red-500/10 rounded">
                          {step.error}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Stage events */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-white/50 mb-2">
              Stage events ({eventsLoading ? '…' : events.length})
            </h3>
            {eventsLoading ? (
              <p className="text-sm text-white/40">Loading…</p>
            ) : events.length === 0 ? (
              <p className="text-sm text-white/40">No stage events recorded.</p>
            ) : (
              <ul className="space-y-1 max-h-80 overflow-y-auto">
                {events.map((ev) => (
                  <li
                    key={ev.id}
                    className="text-[11px] flex items-center gap-2 px-2 py-1 glass-sm rounded"
                  >
                    <span
                      className={
                        ev.level === 'error'
                          ? 'text-red-300'
                          : ev.level === 'warn'
                          ? 'text-amber-300'
                          : 'text-blue-300'
                      }
                    >
                      {ev.level}
                    </span>
                    <span className="text-white/50">{ev.stage}</span>
                    <span className="text-white/85 font-mono truncate flex-1">
                      {ev.event_type}
                    </span>
                    <span className="text-white/30 tabular-nums">
                      {new Date(ev.created_at).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Summary JSON */}
          {run.summary && (
            <section>
              <details>
                <summary className="text-xs uppercase tracking-wider text-white/50 cursor-pointer">
                  Summary JSON
                </summary>
                <pre className="mt-2 text-[11px] text-white/70 font-mono whitespace-pre-wrap break-words bg-black/20 rounded p-3 max-h-72 overflow-auto">
                  {JSON.stringify(run.summary, null, 2)}
                </pre>
              </details>
            </section>
          )}

          {run.error && (
            <section className="px-3 py-2 bg-red-500/10 rounded text-xs text-red-300">
              {run.error}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
