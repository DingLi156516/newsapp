'use client'

/**
 * components/organisms/PipelineTopErrorsPanel.tsx — at-a-glance error
 * hotspots over the last N hours, grouped by (stage, event_type).
 *
 * No hardcoded runbook URLs — operators read docs/operations.md for
 * what each event_type means. We just expose the signature, count,
 * recency, and a sample payload.
 */

import { useMemo, useState } from 'react'
import { AlertOctagon, X } from 'lucide-react'
import { useTopErrors } from '@/lib/hooks/use-top-errors'
import { Skeleton } from '@/components/atoms/Skeleton'
import type { TopErrorRow } from '@/lib/api/pipeline-top-errors'

const WINDOW_OPTIONS: ReadonlyArray<{ readonly hours: number; readonly label: string }> = [
  { hours: 1, label: '1h' },
  { hours: 24, label: '24h' },
  { hours: 168, label: '7d' },
]

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'just now'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function PayloadModal({ row, onClose }: { readonly row: TopErrorRow; readonly onClose: () => void }) {
  const pretty = useMemo(() => JSON.stringify(row.samplePayload, null, 2), [row.samplePayload])
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div className="glass max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/10">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/50">{row.stage}</div>
            <div className="text-base font-mono text-white">{row.eventType}</div>
            <div className="text-[11px] text-white/40 mt-1">
              sample run {row.sampleRunId.slice(0, 8)}…
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-white/60 hover:text-white/90 p-1">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-auto">
          <pre className="text-[12px] text-white/80 font-mono whitespace-pre-wrap break-words">
            {pretty}
          </pre>
        </div>
      </div>
    </div>
  )
}

export function PipelineTopErrorsPanel() {
  const [windowHours, setWindowHours] = useState(24)
  const [selected, setSelected] = useState<TopErrorRow | null>(null)
  const { errors, isLoading, error } = useTopErrors(windowHours)

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2
          className="text-lg font-bold text-white flex items-center gap-2"
          style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
        >
          <AlertOctagon size={16} className="text-red-300" />
          Top Errors
        </h2>
        <div className="flex items-center gap-1">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.hours}
              type="button"
              onClick={() => setWindowHours(opt.hours)}
              className={`glass-pill px-2 py-0.5 text-[11px] transition-colors ${
                windowHours === opt.hours ? 'text-white bg-white/10' : 'text-white/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-2xl animate-shimmer" />
          ))}
        </div>
      ) : error ? (
        <div className="glass-sm px-4 py-6 text-center text-sm text-red-400">{error}</div>
      ) : errors.length === 0 ? (
        <div className="glass-sm px-4 py-8 text-center text-sm text-white/40">
          No warn/error events in the last {windowHours}h
        </div>
      ) : (
        <div data-testid="top-errors-list" className="space-y-2">
          {errors.map((row) => (
            <button
              key={`${row.stage}::${row.eventType}`}
              type="button"
              onClick={() => setSelected(row)}
              className="glass-sm w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors rounded-2xl"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="glass-pill px-2 py-0.5 text-[11px] text-white/70">{row.stage}</span>
                <span className="text-sm text-white/85 font-mono truncate">{row.eventType}</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-white/50 tabular-nums">
                <span>last {formatRelative(row.lastSeen)}</span>
                <span>first {formatRelative(row.firstSeen)}</span>
                <span className="text-amber-300 font-semibold">×{row.count}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && <PayloadModal row={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
