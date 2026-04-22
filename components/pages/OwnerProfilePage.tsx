'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, ExternalLink, Globe } from 'lucide-react'
import { useOwnerProfile } from '@/lib/hooks/use-owner-profile'
import {
  BIAS_COLOR,
  BIAS_LABELS,
  OWNER_TYPE_LABELS,
  REGION_LABELS,
  TOPIC_LABELS,
} from '@/lib/types'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { MonochromeSpectrumBar } from '@/components/molecules/MonochromeSpectrumBar'
import { Skeleton } from '@/components/atoms/Skeleton'
import { UserMenu } from '@/components/organisms/UserMenu'

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function OwnerProfilePage({ slug }: { slug: string }) {
  const router = useRouter()
  const { profile, isLoading, isError, notFound } = useOwnerProfile(slug)

  if (isLoading) {
    return (
      <div className="min-h-screen mesh-gradient">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
          <Skeleton className="h-10 w-1/2" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen mesh-gradient flex items-center justify-center">
        <div className="glass p-8 text-center space-y-4" data-testid="owner-profile-not-found">
          <p className="text-white/70">Owner not found</p>
          <button
            onClick={() => router.push('/?view=sources')}
            className="text-sm text-white/70 hover:text-white/90 transition-colors"
          >
            Back to directory
          </button>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-screen mesh-gradient flex items-center justify-center">
        <div className="glass p-8 text-center space-y-4" data-testid="owner-profile-error">
          <p className="text-white/70">Couldn&apos;t load owner profile. Please try again.</p>
          <button
            onClick={() => router.refresh()}
            className="text-sm text-white/70 hover:text-white/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!profile) {
    return null
  }

  const {
    owner,
    sources,
    recentStories,
    topicBreakdown,
    biasDistribution,
    storyCount,
    blindspotCount,
  } = profile

  return (
    <div className="min-h-screen mesh-gradient">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <UserMenu />
        </div>

        <header className="space-y-3" data-testid="owner-profile-header">
          <h1
            className="text-3xl font-bold text-white"
            style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
          >
            {owner.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="glass-pill px-3 py-1 text-xs text-white/80">
              {OWNER_TYPE_LABELS[owner.ownerType]}
            </span>
            {owner.country && (
              <span className="glass-pill px-3 py-1 text-xs text-white/70 inline-flex items-center gap-1">
                <Globe size={12} />
                {owner.country}
              </span>
            )}
            <span className="text-xs text-white/55">
              {sources.length} {sources.length === 1 ? 'source' : 'sources'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/?owner=${encodeURIComponent(owner.slug)}&tab=latest`}
              data-testid="owner-profile-view-feed"
              className="glass-pill px-3 py-1.5 text-xs text-white/80 hover:text-white transition-colors inline-flex items-center gap-1"
              // The feed filter covers the full 180-day article window, which
              // intentionally includes recently retired outlets — that's why the
              // feed story count can exceed what the "Sources" section (active
              // only) implies.
              title="Recent 180-day coverage from this owner's outlets (includes retired sources)"
            >
              View feed
              <ArrowRight size={12} />
            </Link>
            {owner.wikidataQid && (
              <a
                href={`https://www.wikidata.org/wiki/${owner.wikidataQid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-white/55 hover:text-white/80 transition-colors"
              >
                {owner.wikidataQid}
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="glass p-5 space-y-4" data-testid="owner-profile-snapshot">
            <p className="text-xs text-white/60 uppercase tracking-widest">Snapshot</p>
            <div className="space-y-3 text-sm text-white/75">
              <div className="flex items-center justify-between gap-3">
                <span>Owner type</span>
                <span>{OWNER_TYPE_LABELS[owner.ownerType]}</span>
              </div>
              {owner.country && (
                <div className="flex items-center justify-between gap-3">
                  <span>Country</span>
                  <span>{owner.country}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span>Sources</span>
                <span>{sources.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Data source</span>
                <span className="capitalize">{owner.ownerSource}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Verified</span>
                <span>{formatDate(owner.ownerVerifiedAt)}</span>
              </div>
            </div>
          </section>

          <section className="glass p-5 space-y-4" data-testid="owner-profile-coverage">
            <p className="text-xs text-white/60 uppercase tracking-widest">Coverage Tendencies</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-sm p-3 space-y-1">
                <p className="text-xs uppercase tracking-widest text-white/45">Recent stories</p>
                <p className="text-2xl font-semibold text-white">{storyCount}</p>
              </div>
              <div className="glass-sm p-3 space-y-1">
                <p className="text-xs uppercase tracking-widest text-white/45">Blindspots</p>
                <p className="text-2xl font-semibold text-white">{blindspotCount}</p>
              </div>
            </div>
            {biasDistribution.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-widest text-white/45">Bias mix</p>
                <MonochromeSpectrumBar segments={biasDistribution} showLabels />
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-white/45">Topic mix</p>
              {topicBreakdown.length > 0 ? (
                <div className="space-y-2">
                  {topicBreakdown.slice(0, 4).map((item) => (
                    <div key={item.topic} className="flex items-center justify-between text-sm text-white/75">
                      <span>{TOPIC_LABELS[item.topic]}</span>
                      <span>{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/55">No recent coverage in the current window.</p>
              )}
            </div>
          </section>
        </div>

        <section className="glass p-5 space-y-4" data-testid="owner-profile-sources">
          <p className="text-xs text-white/60 uppercase tracking-widest">Sources</p>
          {sources.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {sources.map((source) => (
                <Link
                  key={source.id}
                  href={`/sources/${source.slug ?? source.id}`}
                  className="glass-sm p-4 space-y-2 hover:bg-white/5 transition-colors"
                  data-testid="owner-profile-source-card"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-white">{source.name}</span>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-medium text-white/90"
                      style={{ backgroundColor: `${BIAS_COLOR[source.bias]}1A` }}
                    >
                      {BIAS_LABELS[source.bias]}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/55">
                    <FactualityBar level={source.factuality} />
                    <span>{REGION_LABELS[source.region]}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/55">
              This owner has no currently active outlets in our directory. Historical coverage
              from retired outlets may still appear on story pages and in the owner feed filter.
            </p>
          )}
        </section>

        <section className="glass p-5 space-y-4" data-testid="owner-profile-recent">
          <p className="text-xs text-white/60 uppercase tracking-widest">Recent Coverage</p>
          {recentStories.length > 0 ? (
            <div className="space-y-3">
              {recentStories.slice(0, 10).map((story) => (
                <div key={story.id} className="glass-sm p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/story/${story.id}`}
                      className="font-medium text-white hover:text-white/80 transition-colors"
                    >
                      {story.headline}
                    </Link>
                    <span className="text-xs text-white/45 whitespace-nowrap">
                      {formatTimestamp(story.timestamp)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/55">
                    <span>{TOPIC_LABELS[story.topic]}</span>
                    <span>{REGION_LABELS[story.region]}</span>
                    <span>{story.isBlindspot ? 'Blindspot coverage' : 'Broad coverage'}</span>
                    {story.articleUrl && (
                      <a
                        href={story.articleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-white/80 transition-colors"
                      >
                        Source article
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/55">No recent coverage found for this owner in the last 180 days.</p>
          )}
        </section>

        <section className="glass p-5 space-y-3">
          <p className="text-xs text-white/60 uppercase tracking-widest">Methodology</p>
          <p className="text-sm leading-6 text-white/70">
            Ownership records are seeded from Wikidata (P127 &quot;owned by&quot;) and occasionally
            hand-curated when the public data is missing. Recent coverage is assembled from the
            last 180 days of articles linked to any active source controlled by this owner, then
            deduplicated into distinct story clusters so repeated follow-ups don&apos;t inflate
            counts.
          </p>
          <p className="text-sm leading-6 text-white/55">
            Bias distribution is a frequency count across this owner&apos;s active sources — it
            reflects the spread of editorial voices under the same roof, not the dominance of any
            one outlet.
          </p>
        </section>
      </div>
    </div>
  )
}
