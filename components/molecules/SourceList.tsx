/**
 * components/molecules/SourceList.tsx — Collapsible list of news sources for an article.
 *
 * This is the most complex molecule component. It has two layers of expansion:
 *   1. `expanded`  — Whether the list is open at all (accordion toggle).
 *   2. `showAll`   — Whether all sources are visible or just the first `maxVisible`.
 *
 * Framer Motion is used for two animated behaviors:
 *   - The chevron icon rotates 180° when expanded (spring animation).
 *   - The list panel animates between height: 0 → height: auto on expand/collapse
 *     using `AnimatePresence` + `motion.div`. The `initial={false}` on AnimatePresence
 *     prevents the animation from running on first render (only on subsequent toggles).
 *
 * Props:
 *   sources          — Array of NewsSource objects to display.
 *   defaultExpanded  — If true, the list starts open (used on the detail page).
 *   maxVisible       — Max sources shown before the "Show N more" button appears.
 */
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ExternalLink } from 'lucide-react'
import type { NewsSource } from '@/lib/types'
import { OWNERSHIP_LABELS } from '@/lib/types'
import { BiasTag } from '@/components/atoms/BiasTag'
import { FactualityDots } from '@/components/atoms/FactualityDots'

interface Props {
  sources: NewsSource[]
  defaultExpanded?: boolean
  maxVisible?: number
}

export function SourceList({
  sources,
  defaultExpanded = false,
  maxVisible = 5,
}: Props) {
  // `expanded` controls whether the accordion is open.
  // Initialized from the `defaultExpanded` prop so the detail page can start open.
  const [expanded, setExpanded] = useState(defaultExpanded)

  // `showAll` controls whether all sources are visible or just the first N.
  const [showAll, setShowAll] = useState(false)

  // Slice the source list based on the showAll flag.
  const visibleSources = showAll ? sources : sources.slice(0, maxVisible)
  // How many sources are hidden behind the "Show more" button.
  const hiddenCount = sources.length - maxVisible

  return (
    <div className="glass-sm overflow-hidden">
      {/* Accordion header / toggle button */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
        aria-expanded={expanded}
      >
        <span className="text-sm font-medium text-white/80">
          Sources ({sources.length})
        </span>
        {/* The chevron rotates to 180° when expanded, indicating the direction of the panel */}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <ChevronDown size={16} className="text-white/70" />
        </motion.div>
      </button>

      {/*
        AnimatePresence manages the mount/unmount lifecycle of the animated panel.
        When `expanded` is false, the motion.div is removed from the DOM entirely,
        but AnimatePresence intercepts the removal and plays the `exit` animation first.

        `initial={false}` — skip the entry animation on the very first render
        (we don't want it to animate open when the page first loads).
      */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            // height: 0 → auto (open) animated with a spring physics curve
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ overflow: 'hidden' }}  // Prevents content peeking during animation
          >
            <ul className="px-4 pb-3 space-y-2">
              {visibleSources.map((source) => (
                <li
                  key={source.id}
                  className="flex items-center gap-2.5 py-1"
                >
                  {/* Bias dot colored by source.bias */}
                  <BiasTag bias={source.bias} size="xs" />
                  {/* 1–5 factuality dots */}
                  <FactualityDots level={source.factuality} />
                  <span className="flex-1 text-sm text-white/70 truncate">
                    {source.name}
                  </span>
                  {/* Ownership type — hidden on mobile (sm:block shows it on ≥640px screens) */}
                  <span className="text-xs text-white/60 whitespace-nowrap hidden sm:block">
                    {OWNERSHIP_LABELS[source.ownership]}
                  </span>
                  {/* External link — only shown if the source has a URL */}
                  {source.url && (
                    <a
                      href={`https://${source.url}`}
                      target="_blank"          // Opens in new tab
                      rel="noopener noreferrer" // Security: prevents new tab from accessing window.opener
                      className="flex-shrink-0 text-white/60 hover:text-white/70 transition-colors"
                      aria-label={`Visit ${source.name}`}
                      // Stop click from bubbling up (e.g., to a parent card click handler)
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </li>
              ))}
            </ul>

            {/* "Show N more sources" button — only visible if there are hidden sources */}
            {hiddenCount > 0 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full px-4 pb-3 text-xs text-white/70 hover:text-white/90 transition-colors text-left"
              >
                Show {hiddenCount} more sources
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
