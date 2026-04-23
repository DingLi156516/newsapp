'use client'

import { Newspaper, CheckCircle2, AlertTriangle, Layers, Cpu, Timer, Hourglass, Clock, Lock, FileText } from 'lucide-react'
import { usePipelineStats } from '@/lib/hooks/use-pipeline'
import { useOldestPending } from '@/lib/hooks/use-oldest-pending'
import { useBacklogSnapshots } from '@/lib/hooks/use-backlog-snapshots'
import { Sparkline } from '@/components/atoms/Sparkline'
import type { PipelineStats } from '@/lib/hooks/use-pipeline'
import type { OldestPendingPayload } from '@/lib/hooks/use-oldest-pending'
import type { DbPipelineBacklogSnapshot } from '@/lib/supabase/types'

interface StatCard {
  readonly label: string
  readonly value: string
  readonly icon: typeof Newspaper
  readonly color: string
  readonly testId?: string
  readonly trend?: ReadonlyArray<number>
  readonly trendColor?: string
}

type SnapshotKey = 'unembedded_count' | 'unclustered_count' | 'pending_assembly_count' | 'review_queue_count' | 'stale_claim_count'

function pickTrend(snapshots: ReadonlyArray<DbPipelineBacklogSnapshot>, key: SnapshotKey): number[] {
  return snapshots.map((s) => s[key] ?? 0)
}

function formatAgeFromIso(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return '0m'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function buildPrimaryCards(
  stats: PipelineStats,
  snapshots: ReadonlyArray<DbPipelineBacklogSnapshot>
): StatCard[] {
  return [
    { label: 'Published', value: stats.publishedStories.toLocaleString(), icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'Articles', value: stats.totalArticles.toLocaleString(), icon: Newspaper, color: 'text-blue-400' },
    {
      label: 'In Review',
      value: stats.reviewQueue.toLocaleString(),
      icon: AlertTriangle,
      color: 'text-amber-400',
      trend: pickTrend(snapshots, 'review_queue_count'),
      trendColor: 'rgb(252 211 77)',
    },
    {
      label: 'Unembedded',
      value: stats.unembedded.toLocaleString(),
      icon: Cpu,
      color: 'text-white/50',
      trend: pickTrend(snapshots, 'unembedded_count'),
      trendColor: 'rgba(255,255,255,0.45)',
    },
    {
      label: 'Unclustered',
      value: stats.unclustered.toLocaleString(),
      icon: Layers,
      color: 'text-white/50',
      trend: pickTrend(snapshots, 'unclustered_count'),
      trendColor: 'rgba(255,255,255,0.45)',
    },
    { label: 'Expired', value: stats.expiredArticles.toLocaleString(), icon: Timer, color: 'text-white/50' },
  ]
}

function buildSloCards(
  payload: OldestPendingPayload,
  snapshots: ReadonlyArray<DbPipelineBacklogSnapshot>
): StatCard[] {
  const totalStale =
    payload.stale.staleEmbedClaims +
    payload.stale.staleClusterClaims +
    payload.stale.staleAssemblyClaims

  return [
    {
      label: 'Oldest Embed',
      value: formatAgeFromIso(payload.oldest.oldestEmbedPendingAt),
      icon: Hourglass,
      color: 'text-white/60',
      testId: 'oldest-embed-tile',
    },
    {
      label: 'Oldest Cluster',
      value: formatAgeFromIso(payload.oldest.oldestClusterPendingAt),
      icon: Clock,
      color: 'text-white/60',
      testId: 'oldest-cluster-tile',
    },
    {
      label: 'Oldest Assembly',
      value: formatAgeFromIso(payload.oldest.oldestAssemblyPendingAt),
      icon: FileText,
      color: 'text-white/60',
      testId: 'oldest-assembly-tile',
    },
    {
      label: 'Stale Claims',
      value: totalStale.toLocaleString(),
      icon: Lock,
      color: totalStale > 0 ? 'text-red-400' : 'text-white/50',
      testId: 'stale-claims-tile',
      trend: pickTrend(snapshots, 'stale_claim_count'),
      trendColor: totalStale > 0 ? 'rgb(248 113 113)' : 'rgba(255,255,255,0.45)',
    },
  ]
}

function Tile({ card }: { readonly card: StatCard }) {
  const Icon = card.icon
  return (
    <div
      data-testid={card.testId}
      className="glass-sm rounded-2xl p-3 text-center space-y-1"
    >
      <div className="flex items-center justify-center gap-1.5">
        <Icon size={14} className={card.color} />
        <span className="text-xl font-bold text-white tabular-nums">{card.value}</span>
      </div>
      <p className="text-[10px] uppercase tracking-widest text-white/50">{card.label}</p>
      {card.trend && card.trend.length > 0 && (
        <div className="flex justify-center pt-0.5">
          <Sparkline values={card.trend} color={card.trendColor} title={`${card.label} trend`} />
        </div>
      )}
    </div>
  )
}

export function PipelineSummaryStats() {
  const { stats, isLoading } = usePipelineStats()
  const { payload, error: sloError } = useOldestPending()
  const { snapshots } = useBacklogSnapshots(24)

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="glass-sm rounded-2xl p-3 h-[72px] animate-shimmer" />
        ))}
      </div>
    )
  }

  const primary = buildPrimaryCards(stats, snapshots)
  const slo = payload ? buildSloCards(payload, snapshots) : []

  return (
    <div data-testid="pipeline-summary-stats" className="space-y-3">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {primary.map((card) => (
          <Tile key={card.label} card={card} />
        ))}
      </div>
      {sloError && (
        <div
          data-testid="slo-error-banner"
          className="glass-sm border border-red-500/30 bg-red-500/5 rounded-2xl px-4 py-2 text-xs text-red-300"
        >
          SLO telemetry unavailable: {sloError}
        </div>
      )}
      {slo.length > 0 && (
        <div data-testid="pipeline-slo-tiles" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {slo.map((card) => (
            <Tile key={card.label} card={card} />
          ))}
        </div>
      )}
      {payload && payload.reviewReasons.length > 0 && (
        <div
          data-testid="review-reason-breakdown"
          className="glass-sm rounded-2xl px-4 py-2 flex flex-wrap items-center gap-2 text-[11px]"
        >
          <span className="uppercase tracking-widest text-white/50">Review reasons:</span>
          {payload.reviewReasons.map((r) => (
            <span
              key={r.reason}
              className="glass-pill px-2 py-0.5 text-white/75"
            >
              {r.reason.replace(/_/g, ' ')} ·{' '}
              <span className="text-white/50">{r.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
