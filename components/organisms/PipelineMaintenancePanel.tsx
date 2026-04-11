'use client'

/**
 * components/organisms/PipelineMaintenancePanel.tsx — Operator UI for
 * the pipeline maintenance purges. Closes Codex finding #11 (MEDIUM).
 *
 * Every button runs the dry-run first, shows a modal with the count +
 * sample IDs, and only sends a real run after the operator confirms.
 */

import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import {
  usePipelineMaintenance,
  type MaintenanceAction,
  type MaintenanceResult,
} from '@/lib/hooks/use-pipeline-maintenance'

interface PurgeDefinition {
  readonly action: MaintenanceAction['action']
  readonly label: string
  readonly description: string
  readonly allowsOlderThanDays: boolean
}

const PURGES: readonly PurgeDefinition[] = [
  {
    action: 'purge_unembedded_articles',
    label: 'Purge unembedded articles',
    description:
      'Delete articles older than 7 days that never received embeddings. Replaces migration 025 #1.',
    allowsOlderThanDays: true,
  },
  {
    action: 'purge_orphan_stories',
    label: 'Purge orphan stories',
    description:
      'Delete story rows whose only articles have been removed. Replaces migration 025 #5 / 026 #3.',
    allowsOlderThanDays: false,
  },
  {
    action: 'purge_expired_articles',
    label: 'Purge expired articles',
    description:
      'Delete articles with clustering_status = expired. Replaces migration 025 #2.',
    allowsOlderThanDays: false,
  },
]

interface PendingConfirm {
  readonly definition: PurgeDefinition
  readonly dryRunResult: MaintenanceResult
}

export function PipelineMaintenancePanel() {
  const { runMaintenance, isRunning } = usePipelineMaintenance()
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const [lastResult, setLastResult] = useState<MaintenanceResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<MaintenanceAction['action'] | null>(null)

  async function startDryRun(definition: PurgeDefinition) {
    setError(null)
    setLastResult(null)
    setBusyAction(definition.action)
    try {
      const result = await runMaintenance({
        action: definition.action,
        dryRun: true,
      })
      if (result) {
        setPending({ definition, dryRunResult: result })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dry-run failed')
    } finally {
      setBusyAction(null)
    }
  }

  async function confirmRealRun() {
    if (!pending) return

    // Snapshot then clear pending BEFORE awaiting. This closes the
    // double-submit race: a rapid second click on Confirm before the
    // real-run POST resolves would otherwise hit the same `pending`
    // and fire a second destructive call. Clearing pending
    // synchronously makes the second click see `!pending` and return.
    const definition = pending.definition
    setPending(null)
    setError(null)
    setBusyAction(definition.action)
    try {
      const result = await runMaintenance({
        action: definition.action,
        dryRun: false,
      })
      if (result) {
        setLastResult(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Real run failed')
    } finally {
      setBusyAction(null)
    }
  }

  function cancelConfirm() {
    setPending(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2
          className="text-lg font-bold text-white"
          style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
        >
          Maintenance
        </h2>
        <span className="text-[11px] text-white/40">
          Dry-run first, then confirm
        </span>
      </div>

      {error && (
        <div className="glass-sm px-4 py-3 text-sm text-red-300 border border-red-400/20">
          {error}
        </div>
      )}

      {lastResult && !error && (
        <div className="glass-sm px-4 py-3 text-sm text-emerald-300 border border-emerald-400/20">
          {lastResult.action}: deleted {lastResult.deletedCount} rows. Audit id{' '}
          <span className="font-mono text-white/70">{lastResult.auditId}</span>.
        </div>
      )}

      <div className="space-y-2">
        {PURGES.map((definition) => (
          <div
            key={definition.action}
            className="glass-sm flex items-center justify-between px-4 py-3"
          >
            <div className="min-w-0 flex-1 mr-3">
              <p className="text-sm font-medium text-white">{definition.label}</p>
              <p className="text-xs text-white/50 mt-0.5">
                {definition.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => startDryRun(definition)}
              disabled={isRunning && busyAction === definition.action}
              className="glass-pill flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-400/20 disabled:opacity-50"
            >
              <Trash2 size={12} />
              {isRunning && busyAction === definition.action
                ? 'Running…'
                : definition.label}
            </button>
          </div>
        ))}
      </div>

      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <div className="glass max-w-xl w-full overflow-hidden flex flex-col">
            <div className="flex items-start justify-between px-5 py-4 border-b border-white/10">
              <div>
                <div className="text-xs uppercase tracking-wider text-white/50">
                  Confirm destructive action
                </div>
                <div className="text-base text-white font-semibold mt-1">
                  {pending.definition.label}
                </div>
              </div>
              <button
                type="button"
                onClick={cancelConfirm}
                aria-label="Close"
                className="text-white/60 hover:text-white/90 p-1"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-white/80">
                Dry-run identified{' '}
                <span className="font-semibold text-amber-300">
                  {pending.dryRunResult.deletedCount}
                </span>{' '}
                rows that would be deleted.
              </p>
              {pending.dryRunResult.sampleIds.length > 0 && (
                <div>
                  <div className="text-xs text-white/50 mb-1">
                    Sample ids (first {pending.dryRunResult.sampleIds.length}):
                  </div>
                  <div className="glass-sm px-3 py-2 text-[11px] font-mono text-white/70 max-h-32 overflow-y-auto">
                    {pending.dryRunResult.sampleIds.join(', ')}
                  </div>
                </div>
              )}
              <p className="text-xs text-white/50">
                Audit id:{' '}
                <span className="font-mono text-white/70">
                  {pending.dryRunResult.auditId}
                </span>
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10">
              <button
                type="button"
                onClick={cancelConfirm}
                className="glass-pill px-4 py-1.5 text-xs text-white/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRealRun}
                disabled={isRunning}
                className="glass-pill px-4 py-1.5 text-xs text-red-300 hover:bg-red-400/20 disabled:opacity-50"
              >
                {isRunning ? 'Running…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
