/**
 * components/molecules/AdminSourceListItem.tsx — Single row in admin source list.
 *
 * Shows source name, bias badge, region, active status, and health indicators.
 * Selected state: amber left-border highlight.
 */

import type { DbSource } from '@/lib/supabase/types'
import { BIAS_LABELS } from '@/lib/types'
import type { BiasCategory } from '@/lib/types'

interface Props {
  readonly source: DbSource
  readonly isSelected: boolean
  readonly onClick: (source: DbSource) => void
}

export function AdminSourceListItem({ source, isSelected, onClick }: Props) {
  const borderClass = isSelected ? 'border-l-amber-400' : 'border-l-transparent'
  const biasLabel = BIAS_LABELS[source.bias as BiasCategory] ?? source.bias
  const hasIssues = source.consecutive_failures > 0 ||
    (source.last_fetch_at !== null && source.last_fetch_status !== 'success')

  return (
    <button
      onClick={() => onClick(source)}
      className={`w-full text-left p-3 border-l-2 ${borderClass} hover:bg-white/5 transition-colors ${
        isSelected ? 'bg-white/5' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-white/90 line-clamp-1 leading-snug font-medium">
          {source.name}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {!source.is_active && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40">
              Inactive
            </span>
          )}
          {hasIssues && source.is_active && (
            <span className="w-2 h-2 rounded-full bg-amber-400" title="Fetch issues" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
        <span className={`spectrum-${source.bias} glass-pill px-1.5 py-0.5 text-[10px]`}>
          {biasLabel}
        </span>
        <span>{source.region.toUpperCase()}</span>
        <span>·</span>
        <span>{source.total_articles_ingested} articles</span>
        <span>·</span>
        <span className={
          source.source_type === 'crawler' ? 'text-blue-400/70'
            : source.source_type === 'news_api' ? 'text-purple-400/70'
              : 'text-green-400/70'
        }>
          {source.source_type === 'crawler' ? 'Crawler'
            : source.source_type === 'news_api' ? 'API'
              : 'RSS'}
        </span>
      </div>
    </button>
  )
}
