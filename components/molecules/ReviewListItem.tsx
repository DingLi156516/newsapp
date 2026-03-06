/**
 * components/molecules/ReviewListItem.tsx — Compact row for the review queue left panel.
 *
 * Shows headline (truncated), topic, source count, and time ago.
 * Selected state: amber left-border. Editing state: blue left-border + badge.
 */

import { ReviewStatusBadge } from '@/components/atoms/ReviewStatusBadge'
import { TOPIC_LABELS } from '@/lib/types'
import type { Topic } from '@/lib/types'

interface ReviewStory {
  readonly id: string
  readonly headline: string
  readonly topic: string
  readonly source_count: number
  readonly review_status: string
  readonly first_published: string
}

interface Props {
  story: ReviewStory
  isSelected: boolean
  isEditing: boolean
  onClick: (id: string) => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function ReviewListItem({ story, isSelected, isEditing, onClick }: Props) {
  const borderClass = isEditing
    ? 'border-l-blue-400'
    : isSelected
      ? 'border-l-amber-400'
      : 'border-l-transparent'

  const topicLabel = TOPIC_LABELS[story.topic as Topic] ?? story.topic

  return (
    <button
      onClick={() => onClick(story.id)}
      className={`w-full text-left p-3 border-l-2 ${borderClass} hover:bg-white/5 transition-colors ${
        isSelected ? 'bg-white/5' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-white/90 line-clamp-2 leading-snug">
          {story.headline}
        </p>
        {isEditing && <ReviewStatusBadge status="editing" />}
      </div>
      <div className="flex items-center gap-2 mt-1.5 text-xs text-white/50">
        <span className="glass-pill px-1.5 py-0.5 text-[10px]">
          {topicLabel}
        </span>
        <span>{story.source_count} sources</span>
        <span>·</span>
        <span>{timeAgo(story.first_published)}</span>
      </div>
    </button>
  )
}
