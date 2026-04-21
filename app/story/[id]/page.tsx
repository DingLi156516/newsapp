/**
 * app/story/[id]/page.tsx — Article detail page (route: "/story/:id").
 *
 * Dynamic route in Next.js App Router: the folder name `[id]` creates a URL
 * parameter. Next.js passes it as `params.id` to the page component.
 *
 * In Next.js 15+, `params` is a Promise (async by design for streaming/PPR
 * compatibility). The `use(params)` call unwraps the Promise synchronously
 * inside a Client Component — it's React's equivalent of `await` but usable
 * in non-async component functions.
 *
 * The article is looked up by ID from `sampleArticles`. If not found (e.g., an
 * invalid URL), a "not found" screen is shown with a back button.
 *
 * Note: bookmark state (`isSaved`) is local to this page instance. It doesn't
 * share bookmarks with the main feed — in a real app you'd lift this state into
 * a global store (Zustand, Redux) or a React Context provider.
 *
 * The page renders:
 *   1. Back button + bookmark button
 *   2. Hero image (dimmed with gradient overlay)
 *   3. Metadata badges (blindspot, source count, topic, factuality)
 *   4. Headline (h1)
 *   5. Coverage spectrum bar (with legend button)
 *   6. AI perspectives tabs
 *   7. Source list (expanded by default, shows 5 sources)
 */
'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { useStory } from '@/lib/hooks/use-story'
import { useStoryTimeline } from '@/lib/hooks/use-story-timeline'
import { TOPIC_LABELS, BIAS_LABELS, BIAS_CSS_CLASS } from '@/lib/types'
import { Skeleton } from '@/components/atoms/Skeleton'
import { MonochromeSpectrumBar } from '@/components/molecules/MonochromeSpectrumBar'
import { SourceList } from '@/components/molecules/SourceList'
import { AISummaryTabs } from '@/components/organisms/AISummaryTabs'
import { BookmarkButton } from '@/components/atoms/BookmarkButton'
import { BlindspotBadge } from '@/components/atoms/BlindspotBadge'
import { MomentumBadge } from '@/components/atoms/MomentumBadge'
import { CoverageCount } from '@/components/atoms/CoverageCount'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { GuideLink } from '@/components/atoms/GuideLink'
import { StoryTimeline } from '@/components/organisms/StoryTimeline'
import { HeadlineComparison } from '@/components/organisms/HeadlineComparison'
import { HeadlineRoundup } from '@/components/organisms/HeadlineRoundup'
import { BiasDriftChart } from '@/components/organisms/BiasDriftChart'
import { KeyQuotes } from '@/components/organisms/KeyQuotes'
import { ClaimsComparison } from '@/components/organisms/ClaimsComparison'
import { UserMenu } from '@/components/organisms/UserMenu'
import { CoverageIntelligence } from '@/components/organisms/CoverageIntelligence'
import { OwnershipSummary } from '@/components/organisms/OwnershipSummary'
import { StoryTagsRow } from '@/components/molecules/StoryTagsRow'
import { StoryScores } from '@/components/molecules/StoryScores'
import { useBookmarks } from '@/lib/hooks/use-bookmarks'
import { useReadingHistory } from '@/lib/hooks/use-reading-history'

/**
 * In Next.js 15, params from dynamic routes are Promises.
 * This interface types the params shape: we expect `{ id: string }`.
 */
interface Props {
  params: Promise<{ id: string }>
}

export default function StoryPage({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()
  const { isBookmarked, toggle } = useBookmarks()
  const { markAsRead } = useReadingHistory()

  const { story: article, isLoading } = useStory(id)
  const { timeline, isLoading: timelineLoading } = useStoryTimeline(id)

  // Mark story as read when viewed
  useEffect(() => {
    if (!isLoading && article) {
      markAsRead(id)
    }
  }, [id, isLoading, article, markAsRead])

  if (isLoading) {
    return (
      <div className="min-h-screen mesh-gradient">
        <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-48 w-full rounded-[24px]" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="min-h-screen mesh-gradient flex items-center justify-center">
        <div className="glass p-8 text-center space-y-4">
          <p className="text-white/70">Story not found</p>
          <button
            onClick={() => router.push('/')}
            className="text-sm text-white/70 hover:text-white/90 transition-colors"
          >
            ← Back to feed
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen mesh-gradient">
      {/* max-w-2xl (~672px) — narrower than the feed for better reading experience */}
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Navigation bar: back button + bookmark */}
        <div className="flex items-center justify-between">
          {/* router.back() goes to the previous history entry (typically the feed) */}
          <button
            onClick={() => router.back()}
            className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="flex items-center gap-2">
            <BookmarkButton
              isSaved={isBookmarked(id)}
              onToggle={() => toggle(id)}
            />
            <UserMenu />
          </div>
        </div>

        {/* Hero image section */}
        {article.imageUrl && (
          <div className="relative h-48 rounded-[24px] overflow-hidden">
            <Image
              src={article.imageUrl}
              alt={article.headline}
              fill
              className="object-cover opacity-40"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          </div>
        )}

        {/* Metadata badges row */}
        <div className="flex items-center flex-wrap gap-2">
          {article.sourceCount > 1 && article.isBlindspot && <BlindspotBadge />}
          {article.storyVelocity && article.storyVelocity.phase !== 'aftermath' && (
            <MomentumBadge phase={article.storyVelocity.phase} />
          )}
          <CoverageCount count={article.sourceCount} />
          <span className="glass-pill px-2.5 py-1 text-xs text-white/70">
            {TOPIC_LABELS[article.topic]}
          </span>
          {/* ml-auto pushes factuality dots to the right end of the row */}
          <div className="flex items-center gap-1.5 ml-auto">
            <FactualityBar level={article.factuality} showLabel />
            <GuideLink section="factuality" />
          </div>
        </div>

        {/* Article headline (h1 — only one per page for SEO/accessibility) */}
        <h1
          className="text-3xl font-bold leading-tight text-white"
          style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
        >
          {article.headline}
        </h1>

        {/* Entity tags */}
        {article.tags && article.tags.length > 0 && (
          <StoryTagsRow tags={article.tags} />
        )}

        {/* Coverage spectrum — full bar for multi-source, single bias pill for single-source */}
        {article.sourceCount > 1 ? (
          <div className="space-y-2">
            <p className="text-xs text-white/60 uppercase tracking-widest">
              Coverage Spectrum
            </p>
            <MonochromeSpectrumBar
              segments={article.spectrumSegments}
              showLegend
              showLabels
              height="md"
            />
          </div>
        ) : article.sources[0] && (
          <div className="space-y-2">
            <p className="text-xs text-white/60 uppercase tracking-widest">
              Source Bias
            </p>
            <span className={`glass-pill px-2.5 py-1 text-xs ${BIAS_CSS_CLASS[article.sources[0].bias]}`}>
              {BIAS_LABELS[article.sources[0].bias]} source
            </span>
          </div>
        )}

        {/* Single-source coverage notice */}
        {article.sourceCount === 1 && (
          <div className="glass-sm px-4 py-3 text-sm text-amber-200/80 leading-relaxed">
            This story is based on a single source. Cross-spectrum analysis is limited —
            perspectives may update as more outlets cover this story.
          </div>
        )}

        {/* AI summary section */}
        <div className="space-y-2">
          <p className="text-xs text-white/60 uppercase tracking-widest">
            {article.sourceCount === 1 ? 'AI Summary' : 'AI Perspectives'}
          </p>
          <AISummaryTabs
            commonGround={article.aiSummary.commonGround}
            leftFraming={article.aiSummary.leftFraming}
            rightFraming={article.aiSummary.rightFraming}
            sentiment={article.sentiment}
            sourceCount={article.sourceCount}
          />
        </div>

        {/* Headline comparison (multi-source only) */}
        {article.sourceCount > 1 && article.headlines && article.headlines.length > 0 && (
          <HeadlineComparison headlines={article.headlines} />
        )}

        {/* Headline roundup — AllSides-style L/C/R picks */}
        {article.sourceCount > 1 && article.headlines && article.headlines.length > 0 && (
          <HeadlineRoundup headlines={article.headlines} />
        )}

        {/* Key quotes */}
        {article.keyQuotes && article.keyQuotes.length > 0 && (
          <KeyQuotes quotes={article.keyQuotes} />
        )}

        {/* Claims comparison */}
        {article.keyClaims && article.keyClaims.length > 0 && (
          <ClaimsComparison claims={article.keyClaims} />
        )}

        {/* Story scores */}
        <StoryScores
          impactScore={article.impactScore}
          sourceDiversity={article.sourceDiversity}
          controversyScore={article.controversyScore}
          sourceCount={article.sourceCount}
        />

        {/* Coverage intelligence (multi-source only) */}
        {article.sourceCount > 1 && (
          <CoverageIntelligence article={article} timeline={timeline} />
        )}

        {/* Bias drift — how the cumulative spectrum evolved */}
        {article.sourceCount > 1 && timeline && (
          <BiasDriftChart
            events={timeline.events}
            currentSourceCount={article.sourceCount}
          />
        )}

        {/* Source ownership summary (Phase 2 — Ground News parity) */}
        <OwnershipSummary
          sources={article.sources}
          ownershipUnavailable={article.ownershipUnavailable}
        />

        {/* Coverage timeline (multi-source only) */}
        {article.sourceCount > 1 && (timelineLoading || (timeline && timeline.events.length > 0)) && (
          <div className="space-y-2">
            <p className="text-xs text-white/60 uppercase tracking-widest">
              Coverage Timeline
            </p>
            <StoryTimeline timeline={timeline} isLoading={timelineLoading} />
          </div>
        )}

        {/* Source list (starts expanded, shows up to 5 sources) */}
        <div className="space-y-2">
          <p className="text-xs text-white/60 uppercase tracking-widest">
            Sources
          </p>
          <SourceList
            sources={article.sources}
            defaultExpanded
            maxVisible={5}
          />
        </div>

        {/* Single-source CTA */}
        {article.sourceCount === 1 && (
          <div className="glass-sm px-4 py-3 text-center text-sm text-white/50">
            Check back as more outlets cover this story
          </div>
        )}
      </div>
    </div>
  )
}
