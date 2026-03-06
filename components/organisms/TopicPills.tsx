/**
 * components/organisms/TopicPills.tsx — Horizontal scrollable topic filter tabs.
 *
 * Renders a pill button for each topic plus an "All" option (represented as null).
 * The active pill gets a sliding frosted-glass background using Framer Motion's
 * `layoutId="topic-pill-highlight"` shared layout animation.
 *
 * `overflow-x-auto scrollbar-hide` allows the pill row to scroll horizontally on
 * mobile when there are more topics than fit on screen, without showing a scrollbar.
 *
 * The `null` topic value means "no filter / show all topics". TypeScript allows null
 * in the array via `(Topic | null)[]`. When `selected === null`, the "All" pill is active.
 *
 * This is a controlled component — the parent (app/page.tsx) owns the `selected` state
 * and updates it via the `onChange` callback.
 */
'use client'

import { motion } from 'framer-motion'
import type { Topic } from '@/lib/types'
import { TOPIC_LABELS } from '@/lib/types'

interface Props {
  selected: Topic | null                 // null = "All topics" selected
  onChange: (t: Topic | null) => void    // Callback to update parent state
}

/**
 * All topic options including null ("All") at the start.
 * Defined outside the component so the array isn't re-created on every render.
 */
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

/**
 * Converts a topic value to its display label.
 * null → "All"; everything else → the TOPIC_LABELS lookup.
 */
function getLabel(topic: Topic | null): string {
  if (topic === null) return 'All'
  return TOPIC_LABELS[topic]
}

export function TopicPills({ selected, onChange }: Props) {
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto scrollbar-hide"
      aria-label="Filter by topic"
    >
      {TOPICS.map((topic) => {
        const isActive = selected === topic
        return (
          <button
            // `topic ?? 'all'` — the nullish coalescing operator: if topic is null/undefined,
            // use 'all' as the key. React requires a unique `key` for each list item.
            key={topic ?? 'all'}
            data-testid={`topic-pill-${topic ?? 'all'}`}
            onClick={() => onChange(topic)}
            // All color/opacity via Tailwind — no inline styles — so hover states work
            className={`flex-shrink-0 relative rounded-full px-4 py-1.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 ${
              isActive
                ? 'text-white'
                : 'text-white/70 ring-1 ring-white/[0.08] hover:text-white hover:ring-white/20 hover:bg-white/[0.05]'
            }`}
            aria-pressed={isActive}  // ARIA toggle state for screen readers
          >
            {/* The sliding glass background pill — only rendered for the active option.
                Framer Motion animates it between pill positions via layoutId. */}
            {isActive && (
              <motion.span
                layoutId="topic-pill-highlight"
                className="absolute inset-0 glass-pill"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            {/* `relative z-10` ensures the label text renders above the background span */}
            <span className="relative z-10">{getLabel(topic)}</span>
          </button>
        )
      })}
    </div>
  )
}
