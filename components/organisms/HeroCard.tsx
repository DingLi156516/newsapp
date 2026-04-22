'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { CoverageCount } from '@/components/atoms/CoverageCount'
import { BlindspotBadge } from '@/components/atoms/BlindspotBadge'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { BookmarkButton } from '@/components/atoms/BookmarkButton'
import { ShareButton } from '@/components/atoms/ShareButton'
import { MonochromeSpectrumBar } from '@/components/molecules/MonochromeSpectrumBar'
import { MetricsRow } from '@/components/molecules/MetricsRow'
import { TOPIC_LABELS } from '@/lib/types'
import type { NewsArticle } from '@/lib/types'

interface Props {
  readonly article: NewsArticle
  readonly onClick: () => void
  readonly onSave: (id: string) => void
  readonly isSaved: boolean
  readonly isRead?: boolean
  readonly showMetrics?: boolean
}

export function HeroCard({ article, onClick, onSave, isSaved, isRead = false, showMetrics = false }: Props) {
  return (
    <motion.article
      data-testid="hero-card"
      className="glass cursor-pointer flex flex-col sm:flex-row gap-5 sm:items-center p-5"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      tabIndex={0}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className="glass-pill px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/50">
            {TOPIC_LABELS[article.topic]}
          </span>
          <CoverageCount count={article.sourceCount} />
          {article.isBlindspot && <BlindspotBadge />}
          {isRead && (
            <span className="glass-pill px-2 py-0.5 text-[10px] text-white/40">
              Read
            </span>
          )}
          <span className="flex items-center gap-0.5 ml-1">
            <FactualityBar level={article.factuality} />
          </span>
          <span className="ml-auto flex items-center gap-2">
            <ShareButton url={`/story/${article.id}`} title={article.headline} storyId={article.id} />
            <BookmarkButton
              isSaved={isSaved}
              onToggle={() => onSave(article.id)}
            />
          </span>
        </div>

        <a
          href={`/story/${article.id}`}
          className="block mb-3"
          aria-label={`Open story: ${article.headline}`}
        >
          <h2 className={`font-serif text-xl font-semibold leading-snug ${isRead ? 'text-white/50' : 'text-white'}`}>
            {article.headline}
          </h2>
        </a>

        {showMetrics && (
          <div className="mb-2">
            <MetricsRow
              impactScore={article.impactScore}
              articles24h={article.storyVelocity?.articles_24h ?? null}
              sourceDiversity={article.sourceDiversity}
            />
          </div>
        )}

        <MonochromeSpectrumBar
          segments={article.spectrumSegments}
          showLabels
          height="md"
        />
      </div>

      {article.imageUrl && (
        <div className="relative w-40 h-[110px] flex-shrink-0 rounded-[14px] overflow-hidden">
          <Image
            src={article.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="160px"
          />
        </div>
      )}
    </motion.article>
  )
}
