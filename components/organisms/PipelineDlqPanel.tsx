/**
 * components/organisms/PipelineDlqPanel.tsx — Dead letter queue tile
 * for the /admin/pipeline dashboard.
 *
 * Renders unreplayed entries from `pipeline_dead_letter` with inline
 * Replay and Dismiss actions. Mirrors the glass / glass-sm / glass-pill
 * styling used by SourceHealthTable and PipelineEventsPanel.
 *
 * Phase 13B — see docs/superpowers/plans and the plan's Open Questions #4.
 *
 * Error surfaces:
 *   - The SWR read error lands in `hookError`.
 *   - The per-row replay/dismiss action error lands in `actionError`
 *     (409 conflicts surface verbatim from the server).
 */
'use client'

import { useState, useCallback } from 'react'
import { RefreshCcw, X } from 'lucide-react'
import { useDlq } from '@/lib/hooks/use-dlq'
import { Skeleton } from '@/components/atoms/Skeleton'
import type { DlqEntry } from '@/lib/pipeline/dead-letter'

const MAX_ERROR_CHARS = 60

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}

function truncateItemId(value: string): string {
  // First 8 chars by plan (`truncated to first 8 chars`). Trailing ellipsis
  // so operators know it is truncated.
  return value.length <= 8 ? value : `${value.slice(0, 8)}…`
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diff)) return iso
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface DlqRowProps {
  readonly entry: DlqEntry
  readonly onReplay: (id: string) => Promise<void>
  readonly onDismiss: (id: string) => Promise<void>
  readonly onError: (message: string) => void
}

function DlqRow({ entry, onReplay, onDismiss, onError }: DlqRowProps) {
  const [pending, setPending] = useState<'replay' | 'dismiss' | null>(null)
  const [expanded, setExpanded] = useState(false)

  const handle = useCallback(
    async (action: 'replay' | 'dismiss') => {
      if (pending !== null) return
      setPending(action)
      try {
        if (action === 'replay') {
          await onReplay(entry.id)
        } else {
          await onDismiss(entry.id)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        onError(message)
      } finally {
        setPending(null)
      }
    },
    [entry.id, onReplay, onDismiss, onError, pending]
  )

  const error = entry.lastError ?? ''
  const isLong = error.length > MAX_ERROR_CHARS
  const displayError = expanded || !isLong ? error : truncate(error, MAX_ERROR_CHARS)

  return (
    <div className="glass-sm px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <span className="glass-pill px-2 py-0.5 text-[11px] text-white/70 font-mono">
            {entry.itemKind}
          </span>
          <span
            className="text-xs text-white/60 font-mono truncate"
            title={entry.itemId}
          >
            {truncateItemId(entry.itemId)}
          </span>
          <span className="text-[11px] text-white/40">
            retries <span className="text-white/70 tabular-nums">{entry.retryCount}</span>
          </span>
          <span className="text-[11px] text-white/30 tabular-nums">
            {formatRelativeTime(entry.failedAt)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handle('replay')}
            disabled={pending !== null}
            className="glass-pill flex items-center gap-1 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCcw size={12} />
            {pending === 'replay' ? 'Replaying…' : 'Replay'}
          </button>
          <button
            type="button"
            onClick={() => handle('dismiss')}
            disabled={pending !== null}
            className="glass-pill flex items-center gap-1 px-3 py-1 text-xs text-white/60 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={12} />
            {pending === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
          </button>
        </div>
      </div>
      {error && (
        <button
          type="button"
          onClick={() => isLong && setExpanded((v) => !v)}
          className={`block w-full text-left text-[11px] font-mono text-red-300/80 ${
            isLong ? 'hover:text-red-300 cursor-pointer' : 'cursor-default'
          }`}
          aria-expanded={isLong ? expanded : undefined}
          aria-label={isLong ? (expanded ? 'Collapse error' : 'Expand error') : undefined}
          disabled={!isLong}
        >
          {/* Rendered as text content (not dangerouslySetInnerHTML). React
              escapes any HTML inside `displayError` automatically. */}
          {displayError}
        </button>
      )}
    </div>
  )
}

export function PipelineDlqPanel() {
  const { entries, isLoading, error: hookError, refresh, replay, dismiss } = useDlq()
  const [actionError, setActionError] = useState<string | null>(null)

  const handleReplay = useCallback(
    async (id: string) => {
      setActionError(null)
      await replay(id)
    },
    [replay]
  )

  const handleDismiss = useCallback(
    async (id: string) => {
      setActionError(null)
      await dismiss(id)
    },
    [dismiss]
  )

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2
          className="text-lg font-bold text-white"
          style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
        >
          Dead Letter Queue
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-white/40 tabular-nums">
            {entries.length} unreplayed
          </span>
          <button
            type="button"
            onClick={() => {
              void refresh()
            }}
            className="glass-pill flex items-center gap-1 px-2 py-0.5 text-[11px] text-white/60 hover:text-white/90"
            aria-label="Refresh DLQ"
          >
            <RefreshCcw size={10} />
            Refresh
          </button>
        </div>
      </div>

      {actionError && (
        <div className="glass-sm border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          {actionError}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-14 w-full rounded-[24px] animate-shimmer"
            />
          ))}
        </div>
      ) : hookError ? (
        <div className="glass-sm px-4 py-6 text-center text-sm text-red-400">
          Failed to load dead letter queue: {hookError}
        </div>
      ) : entries.length === 0 ? (
        <div className="glass-sm px-4 py-8 text-center text-sm text-white/40">
          No DLQ entries — nothing to replay.
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {entries.map((entry) => (
            <DlqRow
              key={entry.id}
              entry={entry}
              onReplay={handleReplay}
              onDismiss={handleDismiss}
              onError={setActionError}
            />
          ))}
        </div>
      )}
    </div>
  )
}
