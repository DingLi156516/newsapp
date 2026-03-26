'use client'

import { Newspaper, CheckCircle2, AlertTriangle, Layers, Cpu, Timer } from 'lucide-react'
import { usePipelineStats } from '@/lib/hooks/use-pipeline'
import type { PipelineStats } from '@/lib/hooks/use-pipeline'

interface StatCard {
  readonly label: string
  readonly value: number
  readonly icon: typeof Newspaper
  readonly color: string
}

function buildCards(stats: PipelineStats): StatCard[] {
  return [
    { label: 'Published', value: stats.publishedStories, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'Articles', value: stats.totalArticles, icon: Newspaper, color: 'text-blue-400' },
    { label: 'In Review', value: stats.reviewQueue, icon: AlertTriangle, color: 'text-amber-400' },
    { label: 'Unembedded', value: stats.unembedded, icon: Cpu, color: 'text-white/50' },
    { label: 'Unclustered', value: stats.unclustered, icon: Layers, color: 'text-white/50' },
    { label: 'Expired', value: stats.expiredArticles, icon: Timer, color: 'text-white/50' },
  ]
}

export function PipelineSummaryStats() {
  const { stats, isLoading } = usePipelineStats()

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="glass-sm rounded-2xl p-3 h-[72px] animate-shimmer" />
        ))}
      </div>
    )
  }

  const cards = buildCards(stats)

  return (
    <div data-testid="pipeline-summary-stats" className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.label} className="glass-sm rounded-2xl p-3 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5">
              <Icon size={14} className={card.color} />
              <span className="text-xl font-bold text-white tabular-nums">
                {card.value.toLocaleString()}
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-white/50">{card.label}</p>
          </div>
        )
      })}
    </div>
  )
}
