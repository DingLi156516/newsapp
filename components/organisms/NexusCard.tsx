/**
 * components/organisms/NexusCard.tsx — The main article card shown in the news feed.
 *
 * "Organisms" are the largest reusable components — they compose atoms and molecules
 * into meaningful product sections. The NexusCard is the primary UI unit of the feed.
 *
 * Each card shows:
 *   - A faint background image (opacity 6%) for texture
 *   - Source count badge, optional Blindspot badge, topic label
 *   - Bookmark toggle button
 *   - Article headline in serif font
 *   - Factuality dots + relative timestamp
 *   - The political spectrum bar (compressed, 4px height)
 *
 * Clicking the card navigates to `/story/:id` — this is handled by the `onClick`
 * callback passed from the parent page, which calls `router.push()`.
 *
 * The whole card is a `motion.article` (Framer Motion's animated <article> element)
 * to get the hover scale and tap scale animations with spring physics.
 *
 * Note on `tabIndex={0}` and `onKeyDown`:
 *   <article> is not natively keyboard-focusable. Adding tabIndex makes it focusable
 *   and onKeyDown lets keyboard users press Enter/Space to navigate, matching
 *   the behavior they'd expect from a link or button.
 */
'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import type { NewsArticle } from '@/lib/types'
import { TOPIC_LABELS } from '@/lib/types'
import { FactualityDots } from '@/components/atoms/FactualityDots'
import { CoverageCount } from '@/components/atoms/CoverageCount'
import { BlindspotBadge } from '@/components/atoms/BlindspotBadge'
import { BookmarkButton } from '@/components/atoms/BookmarkButton'
import { MonochromeSpectrumBar } from '@/components/molecules/MonochromeSpectrumBar'

interface Props {
  article: NewsArticle
  onSave: (id: string) => void  // Passes the article ID up so the parent updates saved state
  isSaved: boolean              // Controlled from the parent — card doesn't own this state
  onClick: () => void           // Navigate to story detail page
  compact?: boolean             // Bento grid variant — smaller card with glass-sm surface
  isRead?: boolean              // Subtle visual indicator for previously read stories
}

/**
 * Converts an ISO 8601 timestamp into a relative human-readable string.
 * Examples: "Just now", "3h ago", "2d ago"
 *
 * Defined as a module-level helper (not a component) since it returns a string,
 * not JSX. Placing it outside the component prevents it from being re-defined
 * on every render.
 */
function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function NexusCard({ article, onSave, isSaved, onClick, compact = false, isRead = false }: Props) {
  const cardClass = compact
    ? 'glass-sm relative cursor-pointer overflow-hidden p-3.5'
    : 'glass relative overflow-hidden cursor-pointer'

  const headlineClass = compact
    ? `font-serif text-[13px] font-semibold leading-snug ${isRead ? 'text-white/50' : 'text-white'}`
    : `font-serif text-xl font-bold leading-tight ${isRead ? 'text-white/50' : 'text-white'}`

  return (
    // motion.article: Framer Motion wraps the semantic <article> element
    // to add physics-based hover/tap animations.
    <motion.article
      data-testid="nexus-card"
      className={cardClass}
      whileHover={{ scale: 1.01 }}   // Subtle scale up on hover
      whileTap={{ scale: 0.99 }}     // Subtle scale down on press
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => {
        // Allow keyboard users to activate the card with Enter or Space
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      aria-label={`Story: ${article.headline}. ${article.sourceCount} sources.`}
    >
      {/* Background image at very low opacity for visual texture.
          `pointer-events-none` ensures the image doesn't intercept clicks.
          Hidden in compact mode to reduce visual noise. */}
      {!compact && article.imageUrl && (
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
          <Image
            src={article.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      )}

      {/* `relative z-10` ensures content renders above the background image */}
      <div className={compact ? 'flex flex-col gap-2' : 'relative z-10 p-5 flex flex-col gap-3'}>
        {/* Top row: badges on the left, bookmark on the right */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center flex-wrap gap-1.5">
            <CoverageCount count={article.sourceCount} />
            {/* Conditionally render the badge — only for blindspot articles */}
            {article.isBlindspot && <BlindspotBadge />}
            {isRead && (
              <span className="glass-pill px-2 py-0.5 text-[10px] text-white/40">
                Read
              </span>
            )}
            <span className="glass-pill px-2.5 py-1 text-xs text-white/70">
              {TOPIC_LABELS[article.topic]}
            </span>
          </div>
          {/* Bookmark button — uses controlled state from the parent */}
          <BookmarkButton
            isSaved={isSaved}
            onToggle={() => onSave(article.id)}
            size="sm"
          />
        </div>

        {/* Headline */}
        <h2
          className={headlineClass}
          style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
        >
          {article.headline}
        </h2>

        {/* Bottom row: factuality rating + relative time */}
        <div className="flex items-center gap-2">
          <FactualityDots level={article.factuality} />
          {/* ml-auto pushes the timestamp to the right end of the row */}
          <span className="text-xs text-white/60 ml-auto">
            {formatTimeAgo(article.timestamp)}
          </span>
        </div>

        {/* Compact 4px spectrum bar — no legend button on cards */}
        <MonochromeSpectrumBar segments={article.spectrumSegments} />
      </div>
    </motion.article>
  )
}
