/**
 * components/organisms/TopicPills.tsx — Horizontal scrollable topic filter tabs.
 *
 * Renders a pill button for each topic plus an "All" option (represented as null).
 * The active pill gets a sliding frosted-glass background using Framer Motion's
 * `layoutId="topic-pill-highlight"` shared layout animation.
 *
 * Promoted tags (dynamic trending topics) render after a subtle divider,
 * with colored dots matching their entity type.
 */
'use client'

import { motion } from 'framer-motion'
import type { Topic, StoryTag } from '@/lib/types'
import { TOPIC_LABELS, TAG_TYPE_COLORS } from '@/lib/types'

interface SelectedTag {
  readonly slug: string
  readonly type?: string
}

interface Props {
  readonly selected: Topic | null
  readonly onChange: (t: Topic | null) => void
  readonly promotedTags?: readonly StoryTag[]
  readonly selectedTag?: SelectedTag | null
  readonly onTagChange?: (tag: SelectedTag | null) => void
}

const TOPICS: (Topic | null)[] = [
  null,
  'politics',
  'world',
  'technology',
  'business',
  'science',
  'health',
  'culture',
  'sports',
  'environment',
]

function getLabel(topic: Topic | null): string {
  if (topic === null) return 'All'
  return TOPIC_LABELS[topic]
}

export function TopicPills({ selected, onChange, promotedTags, selectedTag, onTagChange }: Props) {
  const hasPromotedTags = promotedTags && promotedTags.length > 0
  const isTagActive = selectedTag !== null && selectedTag !== undefined

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto scrollbar-hide"
      aria-label="Filter by topic"
    >
      {TOPICS.map((topic) => {
        const isActive = !isTagActive && selected === topic
        return (
          <button
            key={topic ?? 'all'}
            data-testid={`topic-pill-${topic ?? 'all'}`}
            onClick={() => onChange(topic)}
            className={`flex-shrink-0 relative rounded-full px-4 py-1.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 ${
              isActive
                ? 'text-white'
                : 'text-white/70 ring-1 ring-white/[0.08] hover:text-white hover:ring-white/20 hover:bg-white/[0.05]'
            }`}
            aria-pressed={isActive}
          >
            {isActive && (
              <motion.span
                layoutId="topic-pill-highlight"
                className="absolute inset-0 glass-pill"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10">{getLabel(topic)}</span>
          </button>
        )
      })}

      {/* Promoted tags divider + pills */}
      {hasPromotedTags && (
        <>
          <span className="flex-shrink-0 text-white/20 text-sm select-none" aria-hidden="true">|</span>
          {promotedTags.map((tag) => {
            const isActive = isTagActive && selectedTag?.slug === tag.slug && selectedTag?.type === tag.type
            const dotColor = TAG_TYPE_COLORS[tag.type]
            return (
              <button
                key={`tag-${tag.slug}:${tag.type}`}
                data-testid={`promoted-tag-${tag.slug}`}
                onClick={() => {
                  if (onTagChange) {
                    onTagChange(isActive ? null : { slug: tag.slug, type: tag.type })
                  }
                }}
                className={`flex-shrink-0 relative rounded-full px-4 py-1.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 inline-flex items-center gap-1.5 ${
                  isActive
                    ? 'text-white'
                    : 'text-white/70 ring-1 ring-white/[0.08] hover:text-white hover:ring-white/20 hover:bg-white/[0.05]'
                }`}
                aria-pressed={isActive}
              >
                {isActive && (
                  <motion.span
                    layoutId="topic-pill-highlight"
                    className="absolute inset-0 glass-pill"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <span
                  className="relative z-10 inline-block h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: dotColor }}
                />
                <span className="relative z-10">{tag.label}</span>
              </button>
            )
          })}
        </>
      )}
    </div>
  )
}
