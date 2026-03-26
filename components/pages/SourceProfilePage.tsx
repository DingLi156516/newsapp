'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Rss } from 'lucide-react'
import { useSourceProfile } from '@/lib/hooks/use-source-profile'
import { BIAS_COLOR, BIAS_LABELS, FACTUALITY_LABELS, OWNERSHIP_LABELS, REGION_LABELS, TOPIC_LABELS } from '@/lib/types'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { GuideLink } from '@/components/atoms/GuideLink'
import { SourceLogo } from '@/components/atoms/SourceLogo'
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

export function SourceProfilePage({ slug }: { slug: string }) {
  const router = useRouter()
  const { profile, isLoading } = useSourceProfile(slug)

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

  if (!profile) {
    return (
      <div className="min-h-screen mesh-gradient flex items-center justify-center">
        <div className="glass p-8 text-center space-y-4">
          <p className="text-white/70">Source not found</p>
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

  const { source, recentStories, topicBreakdown, blindspotCount } = profile

  return (
    <div className="min-h-screen mesh-gradient">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/?view=sources')}
            className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Back to directory
          </button>
          <UserMenu />
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-4">
            <div
              className="rounded-2xl p-0.5"
              style={{ boxShadow: `0 0 0 2px ${BIAS_COLOR[source.bias]}40` }}
            >
              <SourceLogo domain={source.url} name={source.name} bias={source.bias} size={64} />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <h1
                className="text-3xl font-bold text-white"
                style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
              >
                {source.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white/90"
                  style={{ backgroundColor: `${BIAS_COLOR[source.bias]}1A` }}
                >
                  {BIAS_LABELS[source.bias]}
                </span>
                <GuideLink section="bias-spectrum" />
                <FactualityBar level={source.factuality} />
                <GuideLink section="factuality" />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {source.url && (
                  <a
                    href={`https://${source.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors"
                  >
                    {source.url}
                    <ExternalLink size={12} />
                  </a>
                )}
                <Link
                  href={`/sources/compare?left=${source.slug}`}
                  className="glass-pill px-3 py-1.5 text-xs text-white/75 hover:text-white transition-colors"
                >
                  Compare →
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="glass p-5 space-y-4">
            <p className="text-xs text-white/60 uppercase tracking-widest">Snapshot</p>
            <div className="space-y-3 text-sm text-white/75">
              <div className="flex items-center justify-between gap-3">
                <span>Bias</span>
                <span>{BIAS_LABELS[source.bias]}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Factuality</span>
                <div className="flex items-center gap-2">
                  <FactualityBar level={source.factuality} />
                  <span>{FACTUALITY_LABELS[source.factuality]}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Ownership</span>
                <span>{OWNERSHIP_LABELS[source.ownership]}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Region</span>
                <span>{REGION_LABELS[source.region]}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Status</span>
                <span>{source.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              {source.url && (
                <a
                  href={`https://${source.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 text-white/70 hover:text-white transition-colors"
                >
                  <span>Website</span>
                  <span className="inline-flex items-center gap-1">
                    {source.url}
                    <ExternalLink size={14} />
                  </span>
                </a>
              )}
              {source.rssUrl && (
                <a
                  href={source.rssUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 text-white/70 hover:text-white transition-colors"
                >
                  <span>RSS feed</span>
                  <span className="inline-flex items-center gap-1">
                    Feed
                    <Rss size={14} />
                  </span>
                </a>
              )}
            </div>
          </section>

          <section className="glass p-5 space-y-4">
            <p className="text-xs text-white/60 uppercase tracking-widest">Coverage Tendencies</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-sm p-3 space-y-1">
                <p className="text-xs uppercase tracking-widest text-white/45">Recent stories</p>
                <p className="text-2xl font-semibold text-white">{recentStories.length}</p>
              </div>
              <div className="glass-sm p-3 space-y-1">
                <p className="text-xs uppercase tracking-widest text-white/45">Blindspots</p>
                <p className="text-2xl font-semibold text-white">{blindspotCount}</p>
              </div>
            </div>
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

        <section className="glass p-5 space-y-4">
          <p className="text-xs text-white/60 uppercase tracking-widest">Recent Coverage</p>
          {recentStories.length > 0 ? (
            <div className="space-y-3">
              {recentStories.map((story) => (
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
            <p className="text-sm text-white/55">No recent coverage found for this source in the last 30 days.</p>
          )}
        </section>

        <section className="glass p-5 space-y-3">
          <p className="text-xs text-white/60 uppercase tracking-widest">Methodology</p>
          <p className="text-sm leading-6 text-white/70">
            Bias, factuality, ownership, and region labels come from the source directory metadata.
            Recent coverage is assembled from the last 30 days of articles linked to this outlet, then
            deduplicated into story clusters so repeated follow-ups on the same event do not inflate counts.
          </p>
          <p className="text-sm leading-6 text-white/55">
            Blindspot participation counts how many recent stories were flagged as ideologically lopsided in
            the broader feed, not whether this source caused the imbalance by itself.
          </p>
        </section>
      </div>
    </div>
  )
}
