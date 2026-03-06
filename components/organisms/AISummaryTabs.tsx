/**
 * components/organisms/AISummaryTabs.tsx — Tabbed AI perspective summary panel.
 *
 * Displays three tabs on the article detail page:
 *   - "Common Ground":  Agreed-upon facts across all political perspectives
 *   - "Left ↗":         How left-leaning outlets framed the story
 *   - "Right ↗":        How right-leaning outlets framed the story
 *
 * Each tab's content is a newline-separated bullet list string (the aiSummary
 * fields from NewsArticle). ContentBlock handles parsing each line and rendering
 * them as <li> elements.
 *
 * Tab switching is animated:
 *   - The active tab underline moves between tabs using Framer Motion's
 *     `layoutId="ai-tab-underline"`. When the same layoutId exists on multiple
 *     elements, Framer Motion animates the transition between their positions
 *     automatically (this is the "shared layout animation" pattern).
 *   - Tab content fades in/out using `AnimatePresence` with `mode="wait"`,
 *     which ensures the exiting content fully disappears before the entering
 *     content appears (sequential, not overlapping).
 */
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  commonGround: string  // Bullet list string, newline-delimited
  leftFraming: string
  rightFraming: string
}

/** Discriminated union for tab IDs — TypeScript catches invalid tab names at compile time */
type TabId = 'common' | 'left' | 'right'

/** Static tab config — label and ID for each tab. Defined outside the component. */
const TABS: { id: TabId; label: string }[] = [
  { id: 'common', label: 'Common Ground' },
  { id: 'left', label: 'Left ↗' },
  { id: 'right', label: 'Right ↗' },
]

/**
 * Parses the newline-separated bullet string and renders it as an unordered list.
 * This is a private sub-component (not exported) — only used inside AISummaryTabs.
 * Lines starting with '•' are rendered as-is; other lines get '• ' prepended.
 */
function ContentBlock({ content }: { content: string }) {
  const lines = content.split('\n').filter((l) => l.trim())
  return (
    <ul className="space-y-2">
      {lines.map((line, i) => (
        <li key={i} className="text-sm text-white/80 leading-relaxed">
          {line.startsWith('•') ? line : `• ${line}`}
        </li>
      ))}
    </ul>
  )
}

export function AISummaryTabs({ commonGround, leftFraming, rightFraming }: Props) {
  /** Currently active tab — controls both the underline position and the rendered content */
  const [activeTab, setActiveTab] = useState<TabId>('common')

  /** Map of tab ID → content string, for clean lookup without switch/if chains */
  const content: Record<TabId, string> = {
    common: commonGround,
    left: leftFraming,
    right: rightFraming,
  }

  return (
    <div className="glass overflow-hidden">
      {/* Tab header row */}
      <div
        role="tablist"
        aria-label="AI perspective summaries"
        className="flex items-center border-b border-white/[0.06]"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            data-testid={`ai-tab-${tab.id}`}
            id={`ai-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`ai-panel-${tab.id}`}  // Links button to its panel for ARIA
            onClick={() => setActiveTab(tab.id)}
            // All color/opacity via Tailwind — no inline styles — so hover states work
            className={`relative flex-1 py-3 text-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 ${
              activeTab === tab.id
                ? 'text-white'
                : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {tab.label}
            {/* Shared layout animation: the underline span "moves" between buttons
                because all three share the same layoutId. Framer Motion interpolates
                the position/size via a FLIP animation under the hood. */}
            {activeTab === tab.id && (
              <motion.span
                layoutId="ai-tab-underline"
                className="absolute bottom-0 left-2 right-2 h-px bg-white/60"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content panel */}
      <div className="p-5 min-h-[120px]">
        {/*
          AnimatePresence mode="wait": waits for exit animation to finish before
          mounting the next component. The `key={activeTab}` tells React (and
          AnimatePresence) that a different tab = a different component instance,
          triggering the mount/unmount animations.
        */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            role="tabpanel"
            id={`ai-panel-${activeTab}`}
            aria-labelledby={`ai-tab-${activeTab}`}
            initial={{ opacity: 0, y: 4 }}   // Starts offset down and transparent
            animate={{ opacity: 1, y: 0 }}   // Animates to natural position
            exit={{ opacity: 0, y: -4 }}     // Exits offset up and transparent
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <ContentBlock content={content[activeTab]} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
