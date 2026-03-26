'use client'

import { useSourceHealth } from '@/lib/hooks/use-pipeline'
import { Skeleton } from '@/components/atoms/Skeleton'
import type { SourceHealthEntry } from '@/lib/hooks/use-pipeline'

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-emerald-400/20 text-emerald-400',
  timeout: 'bg-amber-400/20 text-amber-400',
  http_error: 'bg-red-400/20 text-red-400',
  parse_error: 'bg-orange-400/20 text-orange-400',
  dns_error: 'bg-red-400/20 text-red-400',
  unknown: 'bg-white/10 text-white/40',
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function SourceRow({ source }: { readonly source: SourceHealthEntry }) {
  const statusClass = STATUS_COLORS[source.last_fetch_status] ?? STATUS_COLORS.unknown

  return (
    <div className="glass-sm flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{source.name}</p>
          <p className="text-xs text-white/40">{source.slug}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <span className={`glass-pill px-2 py-0.5 text-xs ${statusClass}`}>
          {source.last_fetch_status}
        </span>
        {source.needs_attention && (
          <span className="glass-pill px-2 py-0.5 text-xs text-amber-300">
            Needs attention
          </span>
        )}
        {source.consecutive_failures > 0 && (
          <span className="text-xs text-red-400 tabular-nums">
            {source.consecutive_failures} fail{source.consecutive_failures !== 1 ? 's' : ''}
          </span>
        )}
        <span className="text-xs text-white/40 tabular-nums">
          {source.total_articles_ingested} articles
        </span>
        <span className="text-xs text-white/30 w-16 text-right">
          {formatRelativeTime(source.last_fetch_at)}
        </span>
      </div>
    </div>
  )
}

export function SourceHealthTable() {
  const { sources, isLoading } = useSourceHealth()

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: 5 }).map((_, i) => (
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
        Source Health
      </h2>

      {sources.length === 0 ? (
        <div className="glass-sm px-4 py-8 text-center text-sm text-white/40">
          No sources found
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => (
            <SourceRow key={source.id} source={source} />
          ))}
        </div>
      )}
    </div>
  )
}
