/**
 * components/organisms/StoryTimeline.tsx — Vertical coverage timeline.
 *
 * Displays how a story's coverage evolved over time as a vertical timeline
 * with glassmorphism cards and Framer Motion stagger animations.
 *
 * Event icons by kind:
 *   - source-added  → Newspaper (blue)
 *   - spectrum-shift → BarChart3 (amber)
 *   - milestone      → Trophy (emerald)
 */
'use client'

import { motion } from 'framer-motion'
import { Newspaper, BarChart3, Trophy } from 'lucide-react'
import type { StoryTimeline as StoryTimelineType, TimelineEventKind } from '@/lib/types'
import { MonochromeSpectrumBar } from '@/components/molecules/MonochromeSpectrumBar'
import { Skeleton } from '@/components/atoms/Skeleton'

interface Props {
  readonly timeline: StoryTimelineType | null
  readonly isLoading: boolean
}

const EVENT_ICONS: Record<TimelineEventKind, { icon: typeof Newspaper; color: string }> = {
  'source-added': { icon: Newspaper, color: 'text-blue-400' },
  'spectrum-shift': { icon: BarChart3, color: 'text-amber-400' },
  'milestone': { icon: Trophy, color: 'text-emerald-400' },
}

const DOT_COLORS: Record<TimelineEventKind, string> = {
  'source-added': 'bg-blue-400',
  'spectrum-shift': 'bg-amber-400',
  'milestone': 'bg-emerald-400',
}

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) {
    return `${diffDays}d ago`
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`
  }
  return 'Just now'
}

function formatSummary(totalArticles: number, timeSpanHours: number): string {
  const days = Math.round(timeSpanHours / 24)
  const timeLabel = days >= 1
    ? `${days} day${days === 1 ? '' : 's'}`
    : `${timeSpanHours} hour${timeSpanHours === 1 ? '' : 's'}`

  return `${totalArticles} article${totalArticles === 1 ? '' : 's'} over ${timeLabel}`
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4" data-testid="timeline-skeleton">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function StoryTimeline({ timeline, isLoading }: Props) {
  if (isLoading) {
    return <TimelineSkeleton />
  }

  if (!timeline || timeline.events.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {/* Timeline nodes */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" aria-hidden="true" />

        <div className="space-y-3">
          {timeline.events.map((event, index) => {
            const { icon: Icon, color } = EVENT_ICONS[event.kind]

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="relative flex gap-3 pl-1"
              >
                {/* Dot on the line */}
                <div className="relative z-10 flex-shrink-0 flex items-start pt-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${DOT_COLORS[event.kind]} ring-2 ring-black/40`} />
                </div>

                {/* Event card */}
                <div className="glass-sm flex-1 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={color} aria-hidden="true" />
                    <span className="text-xs text-white/50">
                      {formatTimeAgo(event.timestamp)}
                    </span>
                    <span className="glass-pill px-1.5 py-0.5 text-[10px] text-white/60 ml-auto">
                      {event.cumulativeSourceCount} source{event.cumulativeSourceCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  <p className="text-sm text-white/80">{event.description}</p>

                  {event.cumulativeSpectrum.length > 0 && (
                    <MonochromeSpectrumBar
                      segments={event.cumulativeSpectrum}
                      height="sm"
                    />
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Summary footer */}
      <p className="text-xs text-white/40 text-center pt-1">
        {formatSummary(timeline.totalArticles, timeline.timeSpanHours)}
      </p>
    </div>
  )
}
