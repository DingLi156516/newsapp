'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { UserMenu } from '@/components/organisms/UserMenu'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { SourceLogo } from '@/components/atoms/SourceLogo'
import { Skeleton } from '@/components/atoms/Skeleton'
import { useSourceComparison } from '@/lib/hooks/use-source-comparison'
import { useSources } from '@/lib/hooks/use-sources'
import {
  BIAS_LABELS,
  FACTUALITY_LABELS,
  OWNERSHIP_LABELS,
  REGION_LABELS,
  TOPIC_LABELS,
} from '@/lib/types'

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface SourceComparisonPageProps {
  leftSlug: string | null
  rightSlug: string | null
}

function SourceSnapshotCard({
  title,
  source,
}: {
  title: string
  source: {
    name: string
    bias: keyof typeof BIAS_LABELS
    factuality: keyof typeof FACTUALITY_LABELS
    ownership: keyof typeof OWNERSHIP_LABELS
    region: keyof typeof REGION_LABELS
    isActive: boolean
    url?: string
  }
}) {
  return (
    <div className="glass-sm p-4 space-y-3">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-white/45">{title}</p>
        <div className="flex items-center gap-2">
          <SourceLogo domain={source.url} name={source.name} bias={source.bias} size={40} />
          <span className="font-medium text-white">{source.name}</span>
        </div>
      </div>
      <div className="space-y-2 text-sm text-white/75">
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
      </div>
    </div>
  )
}

function StoryList({
  title,
  stories,
  emptyText,
}: {
  title: string
  stories: Array<{
    id: string
    headline: string
    topic: keyof typeof TOPIC_LABELS
    timestamp: string
  }>
  emptyText: string
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-widest text-white/45">{title}</p>
      {stories.length > 0 ? (
        <div className="space-y-2">
          {stories.map((story) => (
            <div key={story.id} className="glass-sm p-3 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/story/${story.id}`}
                  className="font-medium text-white hover:text-white/80 transition-colors"
                >
                  {story.headline}
                </Link>
                <span className="text-xs whitespace-nowrap text-white/45">
                  {formatTimestamp(story.timestamp)}
                </span>
              </div>
              <p className="text-xs text-white/55">{TOPIC_LABELS[story.topic]}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/55">{emptyText}</p>
      )}
    </div>
  )
}

export function SourceComparisonPage({ leftSlug, rightSlug }: SourceComparisonPageProps) {
  const router = useRouter()
  const { comparison, isLoading, isError } = useSourceComparison(leftSlug, rightSlug)
  const { sources, isLoading: isSourcesLoading } = useSources()

  const selectableSources = useMemo(
    () => sources
      .filter((source) => source.slug && source.slug !== leftSlug)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [leftSlug, sources]
  )

  function updateComparison(nextRightSlug: string) {
    if (!leftSlug || !nextRightSlug) return
    router.push(`/sources/compare?left=${leftSlug}&right=${nextRightSlug}`)
  }

  return (
    <div className="min-h-screen mesh-gradient">
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => router.push(leftSlug ? `/sources/${leftSlug}` : '/sources')}
            className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            {leftSlug ? 'Back to source' : 'Back to directory'}
          </button>
          <UserMenu />
        </div>

        <div className="space-y-2">
          <p className="text-xs text-white/60 uppercase tracking-widest">Source Comparison</p>
          <h1
            className="text-3xl font-bold text-white"
            style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
          >
            Compare recent coverage across outlets
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-white/65">
            This view compares the last 30 days of clustered stories for two sources to show where
            their coverage overlaps, where it diverges, and which topics one outlet emphasizes more.
          </p>
        </div>

        <section className="glass p-5 space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-white/45">Build comparison</p>
            {!rightSlug && leftSlug && (
              <p className="text-lg font-medium text-white">Choose a second source</p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="compare-against" className="text-sm text-white/75">
              Compare against
            </label>
            <select
              id="compare-against"
              aria-label="Compare against"
              value={rightSlug ?? ''}
              onChange={(event) => updateComparison(event.target.value)}
              disabled={!leftSlug || isSourcesLoading}
              className="glass-sm w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="" className="bg-slate-900">
                Select a source
              </option>
              {selectableSources.map((source) => (
                <option key={source.id} value={source.slug} className="bg-slate-900">
                  {source.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {!leftSlug && (
          <section className="glass p-5">
            <p className="text-sm text-white/65">Pick a source profile first to start a comparison.</p>
          </section>
        )}

        {leftSlug && !rightSlug && (
          <section className="glass p-5">
            <p className="text-sm text-white/65">
              Choose a second outlet to compare its recent coverage against {leftSlug}.
            </p>
          </section>
        )}

        {leftSlug && rightSlug && isLoading && (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full md:col-span-2" />
          </div>
        )}

        {leftSlug && rightSlug && !isLoading && !comparison && (
          <section className="glass p-5 space-y-2">
            <p className="text-lg font-medium text-white">Comparison unavailable</p>
            <p className="text-sm text-white/60">
              {isError
                ? 'One or both sources were not found for this comparison.'
                : 'We could not assemble a comparison for these sources.'}
            </p>
          </section>
        )}

        {comparison && (
          <>
            <section className="glass p-5 space-y-4">
              <p className="text-xs text-white/60 uppercase tracking-widest">Side-by-Side Snapshot</p>
              <div className="grid gap-4 md:grid-cols-2">
                <SourceSnapshotCard title="Left source" source={comparison.leftSource} />
                <SourceSnapshotCard title="Right source" source={comparison.rightSource} />
              </div>
            </section>

            <section className="glass p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-white/60 uppercase tracking-widest">Shared Coverage</p>
                <p className="text-sm text-white/65">
                  {comparison.stats.sharedStoryCount} shared stor{comparison.stats.sharedStoryCount === 1 ? 'y' : 'ies'}
                </p>
              </div>
              {comparison.sharedStories.length > 0 ? (
                <div className="space-y-4">
                  <StoryList
                    title="Shared stories"
                    stories={comparison.sharedStories}
                    emptyText="These sources did not overlap on any recent stories in this window."
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="glass-sm p-4 space-y-2">
                      <p className="text-xs uppercase tracking-widest text-white/45">Top overlapping topics</p>
                      {comparison.stats.overlappingTopics.length > 0 ? (
                        <div className="space-y-2">
                          {comparison.stats.overlappingTopics.slice(0, 4).map((item) => (
                            <div key={item.topic} className="flex items-center justify-between text-sm text-white/75">
                              <span>{TOPIC_LABELS[item.topic]}</span>
                              <span>{item.leftCount} vs {item.rightCount}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-white/55">No overlapping topics appeared in this window.</p>
                      )}
                    </div>
                    <div className="glass-sm p-4 space-y-2">
                      <p className="text-xs uppercase tracking-widest text-white/45">Blindspot participation</p>
                      <div className="space-y-2 text-sm text-white/75">
                        <div className="flex items-center justify-between gap-3">
                          <span>{comparison.leftSource.name}</span>
                          <span>{comparison.stats.leftBlindspotCount}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>{comparison.rightSource.name}</span>
                          <span>{comparison.stats.rightBlindspotCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-white/55">
                  These sources did not overlap on any recent stories in this window.
                </p>
              )}
            </section>

            <section className="glass p-5 space-y-4">
              <p className="text-xs text-white/60 uppercase tracking-widest">Coverage Gaps</p>
              <div className="grid gap-4 md:grid-cols-2">
                <StoryList
                  title={`${comparison.leftSource.name} only`}
                  stories={comparison.leftExclusiveStories}
                  emptyText={`${comparison.leftSource.name} had no exclusive stories in this window.`}
                />
                <StoryList
                  title={`${comparison.rightSource.name} only`}
                  stories={comparison.rightExclusiveStories}
                  emptyText={`${comparison.rightSource.name} had no exclusive stories in this window.`}
                />
              </div>
              <div className="glass-sm p-4 space-y-2">
                <p className="text-xs uppercase tracking-widest text-white/45">Topic imbalances</p>
                {comparison.stats.topicImbalances.length > 0 ? (
                  <div className="space-y-2">
                    {comparison.stats.topicImbalances.slice(0, 6).map((item) => (
                      <div key={item.topic} className="flex items-center justify-between gap-3 text-sm text-white/75">
                        <span>{TOPIC_LABELS[item.topic]}</span>
                        <span>{item.leftCount} vs {item.rightCount}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/55">These outlets emphasized a similar topic mix in this window.</p>
                )}
              </div>
            </section>

            <section className="glass p-5 space-y-3">
              <p className="text-xs text-white/60 uppercase tracking-widest">Methodology</p>
              <p className="text-sm leading-6 text-white/70">
                This comparison uses the last 30 days of articles linked to each outlet, then
                deduplicates them into story clusters so repeated follow-ups do not count as separate
                events. Shared coverage is based on overlap by story cluster ID, while coverage gaps
                show stories that appeared for only one outlet in the same window.
              </p>
              <p className="text-sm leading-6 text-white/55">
                Topic overlap and blindspot counts are descriptive signals from recent coverage, not a
                quality score or a measure of whether one source copied another.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
