/**
 * components/organisms/FeedTabs.tsx — Top-level feed navigation tabs.
 *
 * Renders five tab buttons: For You | Trending | Latest | Blindspot | Saved.
 * The active tab is controlled by the parent (app/page.tsx) via `value` + `onChange`
 * props — this component doesn't own any state (it's a "controlled component",
 * analogous to a controlled input in a form).
 *
 * Badge counts on the Blindspot and Saved tabs are passed in as props so the parent
 * can compute them and pass them down, avoiding duplication of filter logic.
 *
 * Animation: The active underline moves between tabs using Framer Motion's
 * `layoutId="feed-tab-underline"` shared layout animation — the same pattern
 * used in AISummaryTabs.
 */
'use client'

import { motion } from 'framer-motion'
import type { FeedTab } from '@/lib/types'

interface Props {
  value: FeedTab                  // Currently active tab (controlled from parent)
  onChange: (v: FeedTab) => void  // Callback to update the parent's feedTab state
  savedCount?: number             // Number of articles bookmarked (badge on "Saved" tab)
  blindspotCount?: number         // Number of blindspot articles (badge on "Blindspot" tab)
}

export function FeedTabs({
  value,
  onChange,
  savedCount = 0,
  blindspotCount = 0,
}: Props) {
  /**
   * Tab config is built inside the component because it depends on the badge
   * counts from props. Each tab optionally has a `badge` number — if undefined,
   * no badge is shown.
   */
  const tabs: { value: FeedTab; label: string; badge?: number }[] = [
    { value: 'for-you', label: 'For You' },
    { value: 'trending', label: 'Trending' },
    { value: 'latest', label: 'Latest' },
    // Only show a badge if the count > 0
    { value: 'blindspot', label: 'Blindspot', badge: blindspotCount > 0 ? blindspotCount : undefined },
    { value: 'saved', label: 'Saved', badge: savedCount > 0 ? savedCount : undefined },
  ]

  return (
    <div
      role="tablist"
      aria-label="Feed tabs"
      className="flex items-center gap-0.5 border-b border-white/[0.06] pb-0"
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          data-testid={`feed-tab-${tab.value}`}
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          // All color/opacity via Tailwind — no inline styles — so hover states work
          className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 ${
            value === tab.value
              ? 'text-white'
              : 'text-white/70 hover:text-white hover:bg-white/[0.04] rounded-t-lg'
          }`}
        >
          {tab.label}
          {/* Render badge count pill if defined (ternary: badge !== undefined avoids falsy 0) */}
          {tab.badge !== undefined && (
            <span className="glass-pill px-1.5 py-0.5 text-[10px] text-white/70 leading-none">
              {tab.badge}
            </span>
          )}
          {/* Active underline — Framer Motion animates it sliding between tabs */}
          {value === tab.value && (
            <motion.span
              layoutId="feed-tab-underline"
              className="absolute bottom-0 left-0 right-0 h-px bg-white"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  )
}
