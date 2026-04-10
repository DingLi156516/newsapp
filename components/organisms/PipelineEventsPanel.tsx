'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { usePipelineEvents } from '@/lib/hooks/use-pipeline-events'
import { Skeleton } from '@/components/atoms/Skeleton'
import type { DbPipelineStageEvent } from '@/lib/supabase/types'
import type { StageKind, StageLevel } from '@/lib/pipeline/stage-events'

const STAGE_OPTIONS: readonly ('all' | StageKind)[] = [
  'all',
  'ingest',
  'embed',
  'cluster',
  'assemble',
  'recluster',
]

const LEVEL_OPTIONS: readonly StageLevel[] = ['info', 'warn', 'error']

const LEVEL_STYLES: Record<StageLevel, { text: string; bg: string; icon: typeof Info }> = {
  debug: { text: 'text-white/50', bg: 'bg-white/5', icon: Info },
  info: { text: 'text-blue-300', bg: 'bg-blue-500/10', icon: Info },
  warn: { text: 'text-amber-300', bg: 'bg-amber-500/10', icon: AlertTriangle },
  error: { text: 'text-red-300', bg: 'bg-red-500/10', icon: AlertCircle },
}

// Matches canonical 8-4-4-4-12 UUIDs (case-insensitive). The API route
// rejects malformed UUIDs with 400, so we validate client-side and only
// include runId in the SWR key when it parses cleanly — otherwise a
// partially typed UUID would spam failed requests while the operator
// pastes the value.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUuid(value: string): boolean {
  return UUID_RE.test(value)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function EventRow({
  event,
  onSelect,
}: {
  readonly event: DbPipelineStageEvent
  readonly onSelect: (event: DbPipelineStageEvent) => void
}) {
  const style = LEVEL_STYLES[event.level] ?? LEVEL_STYLES.info
  const LevelIcon = style.icon

  return (
    <button
      onClick={() => onSelect(event)}
      className="glass-sm w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${style.bg} ${style.text}`}>
          <LevelIcon size={10} />
          {event.level}
        </span>
        <span className="glass-pill px-2 py-0.5 text-[11px] text-white/70">
          {event.stage}
        </span>
        <span className="text-sm text-white/80 font-mono truncate">
          {event.event_type}
        </span>
      </div>
      <span className="text-[11px] text-white/40 tabular-nums shrink-0">
        {formatTime(event.created_at)}
      </span>
    </button>
  )
}

function PayloadModal({
  event,
  onClose,
}: {
  readonly event: DbPipelineStageEvent
  readonly onClose: () => void
}) {
  const pretty = useMemo(
    () => JSON.stringify(event.payload ?? {}, null, 2),
    [event.payload]
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/10">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/50">
              {event.stage} · {event.level}
            </div>
            <div className="text-base font-mono text-white">{event.event_type}</div>
            <div className="text-[11px] text-white/40 mt-1">
              run {event.run_id.slice(0, 8)}… · {formatTime(event.created_at)}
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
        <div className="px-5 py-4 overflow-auto">
          <pre className="text-[12px] text-white/80 font-mono whitespace-pre-wrap break-words">
            {pretty}
          </pre>
          {event.item_id && (
            <div className="mt-4 text-[11px] text-white/50">
              item_id: <span className="font-mono text-white/70">{event.item_id}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function PipelineEventsPanel() {
  // URL-seeded runId filter. Reads ?runId= once on mount; after that the
  // filter is fully controlled locally so operators can clear it.
  const initialRunId = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('runId') ?? ''
  }, [])

  const [runId, setRunId] = useState(initialRunId)
  const [stage, setStage] = useState<'all' | StageKind>('all')
  const [levels, setLevels] = useState<StageLevel[]>(['info', 'warn', 'error'])
  const [selected, setSelected] = useState<DbPipelineStageEvent | null>(null)

  const trimmedRunId = runId.trim()
  const runIdHasValue = trimmedRunId.length > 0
  const runIdIsValid = runIdHasValue && isValidUuid(trimmedRunId)

  const filter = useMemo(
    () => ({
      // Only pass runId to the hook once it looks like a canonical
      // UUID — this prevents transient 400 responses and the
      // accompanying error banner while the operator is typing.
      runId: runIdIsValid ? trimmedRunId : undefined,
      stage: stage === 'all' ? undefined : stage,
      levels,
      limit: 100,
    }),
    [runIdIsValid, trimmedRunId, stage, levels]
  )

  const { events, isLoading, error } = usePipelineEvents(filter)

  const toggleLevel = (level: StageLevel) => {
    setLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2
          className="text-lg font-bold text-white"
          style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
        >
          Stage Events
        </h2>
        <span className="text-[11px] text-white/40">
          {events.length} shown
        </span>
      </div>

      {/* Filter bar */}
      <div className="glass-sm px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {LEVEL_OPTIONS.map((level) => {
            const active = levels.includes(level)
            const style = LEVEL_STYLES[level]
            return (
              <button
                key={level}
                type="button"
                onClick={() => toggleLevel(level)}
                className={`glass-pill px-3 py-1 text-xs transition-colors ${
                  active ? `${style.bg} ${style.text}` : 'text-white/40'
                }`}
              >
                {level}
              </button>
            )
          })}
          <div className="h-4 w-px bg-white/10 mx-1" />
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as 'all' | StageKind)}
            className="glass-pill px-3 py-1 text-xs text-white/80 bg-transparent focus:outline-none"
            aria-label="Stage filter"
          >
            {STAGE_OPTIONS.map((s) => (
              <option key={s} value={s} className="bg-black text-white">
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            placeholder="Run ID (uuid)"
            aria-label="Run ID filter"
            aria-invalid={runIdHasValue && !runIdIsValid}
            className="glass-pill flex-1 px-3 py-1 text-xs text-white/80 bg-transparent placeholder:text-white/30 focus:outline-none"
          />
          {runIdHasValue && (
            <button
              type="button"
              onClick={() => setRunId('')}
              className="text-xs text-white/40 hover:text-white/60 px-2"
            >
              clear
            </button>
          )}
        </div>
        {runIdHasValue && !runIdIsValid && (
          <div className="text-[11px] text-amber-300/80">
            Enter a full UUID (e.g. 8-4-4-4-12 hex) to filter by run.
          </div>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-[24px] animate-shimmer" />
          ))}
        </div>
      ) : error ? (
        <div className="glass-sm px-4 py-6 text-center text-sm text-red-400">
          Failed to load stage events: {error}
        </div>
      ) : events.length === 0 ? (
        <div className="glass-sm px-4 py-8 text-center text-sm text-white/40">
          No stage events match the current filters
        </div>
      ) : (
        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {events.map((event) => (
            <EventRow key={event.id} event={event} onSelect={setSelected} />
          ))}
        </div>
      )}

      {selected && (
        <PayloadModal event={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
