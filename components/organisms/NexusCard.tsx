'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import type { NewsArticle } from '@/lib/types'
import { TOPIC_LABELS } from '@/lib/types'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { CoverageCount } from '@/components/atoms/CoverageCount'
import { BlindspotBadge } from '@/components/atoms/BlindspotBadge'
import { BookmarkButton } from '@/components/atoms/BookmarkButton'
import { ShareButton } from '@/components/atoms/ShareButton'
import { MomentumBadge } from '@/components/atoms/MomentumBadge'
import { MonochromeSpectrumBar } from '@/components/molecules/MonochromeSpectrumBar'
import { MetricsRow } from '@/components/molecules/MetricsRow'

interface Props {
  article: NewsArticle
  onSave: (id: string) => void
  isSaved: boolean
  onClick: () => void
  compact?: boolean
  isRead?: boolean
  showMetrics?: boolean
}

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function NexusCard({ article, onSave, isSaved, onClick, compact = false, isRead = false, showMetrics = false }: Props) {
  const cardClass = compact
    ? 'glass-sm relative cursor-pointer overflow-hidden p-3.5'
    : 'glass relative overflow-hidden cursor-pointer'

  const headlineClass = compact
    ? `font-serif text-[13px] font-semibold leading-snug ${isRead ? 'text-white/50' : 'text-white'}`
    : `font-serif text-xl font-bold leading-tight ${isRead ? 'text-white/50' : 'text-white'}`

  return (
    <motion.article
      data-testid="nexus-card"
      className={cardClass}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      aria-label={`Story: ${article.headline}. ${article.sourceCount} sources.`}
    >
      {/* Non-compact: background image at low opacity for texture */}
      {!compact && article.imageUrl && (
        <div className="absolute inset-0 opacity-[0.15] pointer-events-none">
          <Image
            src={article.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      )}

      <div className={compact ? 'flex gap-3' : 'relative z-10 p-5 flex flex-col gap-3'}>
        {/* Compact: content left + thumbnail right */}
        <div className={compact ? 'flex-1 min-w-0 flex flex-col gap-2' : 'contents'}>
          {/* Top row: badges + actions */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center flex-wrap gap-1.5">
              <CoverageCount count={article.sourceCount} />
              {article.isBlindspot && <BlindspotBadge />}
              {article.storyVelocity && article.storyVelocity.phase !== 'aftermath' && (
                <MomentumBadge phase={article.storyVelocity.phase} />
              )}
              {article.controversyScore != null && article.controversyScore > 0.7 && (
                <span
                  className="inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/15 px-2.5 py-0.5 text-[10px] font-semibold tracking-widest text-orange-300 uppercase"
                  aria-label="High disagreement between political perspectives"
                >
                  HIGH DISAGREEMENT
                </span>
              )}
              {isRead && (
                <span className="glass-pill px-2 py-0.5 text-[10px] text-white/40">
                  Read
                </span>
              )}
              <span className="glass-pill px-2.5 py-1 text-xs text-white/70">
                {TOPIC_LABELS[article.topic]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ShareButton url={`/story/${article.id}`} title={article.headline} size="sm" />
              <BookmarkButton
                isSaved={isSaved}
                onToggle={() => onSave(article.id)}
                size="sm"
              />
            </div>
          </div>

          {/* Headline */}
          <h2
            className={headlineClass}
            style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
          >
            {article.headline}
          </h2>

          {/* Bottom row: factuality + time */}
          <div className="flex items-center gap-2">
            <FactualityBar level={article.factuality} />
            <span className="text-xs text-white/60 ml-auto">
              {formatTimeAgo(article.timestamp)}
            </span>
          </div>

          {/* Trending metrics — shown only when parent sorts by trending */}
          {showMetrics && (
            <MetricsRow
              impactScore={article.impactScore}
              articles24h={article.storyVelocity?.articles_24h ?? null}
              sourceDiversity={article.sourceDiversity}
            />
          )}

          {/* Spectrum bar */}
          <MonochromeSpectrumBar segments={article.spectrumSegments} />
        </div>

        {/* Compact: right-side thumbnail */}
        {compact && article.imageUrl && (
          <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden self-center">
            <Image
              src={article.imageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="80px"
            />
          </div>
        )}
      </div>
    </motion.article>
  )
}
