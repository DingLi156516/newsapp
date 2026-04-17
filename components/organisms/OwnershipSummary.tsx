/**
 * components/organisms/OwnershipSummary.tsx — Above-the-fold ownership
 * intelligence for a story.
 *
 * Renders a headline sentence ("Warner Bros. Discovery covers 6 of 10 sources")
 * and the OwnershipBar. Returns null when there aren't enough sources with
 * known owners to make a meaningful statement (mirrors SourceList's guard
 * rails so we never show a bar with a single slice).
 */
'use client'

import { useMemo } from 'react'
import { AlertTriangle, Building2, User } from 'lucide-react'
import type { NewsSource } from '@/lib/types'
import { OWNER_TYPE_LABELS } from '@/lib/types'
import { computeOwnershipDistribution } from '@/lib/api/ownership-aggregator'
import { OwnershipBar } from '@/components/molecules/OwnershipBar'

interface Props {
  readonly sources: readonly NewsSource[]
  /**
   * When true, the media_owners lookup failed upstream. Render a degraded
   * state so readers can tell an outage apart from stories that legitimately
   * have no known owners. Per Codex round-5 adversarial review.
   */
  readonly ownershipUnavailable?: boolean
}

const MIN_SOURCES = 3

export function OwnershipSummary({ sources, ownershipUnavailable }: Props) {
  const distribution = useMemo(
    () => computeOwnershipDistribution(sources),
    [sources]
  )

  if (ownershipUnavailable) {
    return (
      <section
        className="glass-sm px-4 py-3"
        data-testid="ownership-summary"
        data-state="unavailable"
        aria-label="Source ownership summary"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-400/80 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-white/70">
            Ownership data temporarily unavailable for this story.
          </p>
        </div>
      </section>
    )
  }

  if (sources.length < MIN_SOURCES) return null
  if (distribution.groups.length === 0) return null

  const total = sources.length
  const { dominantOwner, groups } = distribution

  const headline = buildHeadline({ dominantOwner, groups, total })
  const lead = groups[0]

  return (
    <section
      className="glass-sm px-4 py-3 space-y-2"
      data-testid="ownership-summary"
      aria-label="Source ownership summary"
    >
      <div className="flex items-start gap-2">
        {lead.isIndividual ? (
          <User size={14} className="text-white/60 mt-0.5 flex-shrink-0" />
        ) : (
          <Building2 size={14} className="text-white/60 mt-0.5 flex-shrink-0" />
        )}
        <p className="text-sm text-white/80">{headline}</p>
      </div>
      <OwnershipBar distribution={distribution} totalSources={total} />
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/50">
        {groups.slice(0, 4).map((group) => (
          <span key={group.ownerId} className="inline-flex items-center gap-1">
            <span className="font-medium text-white/70">{group.ownerName}</span>
            <span className="text-white/40">
              · {group.sourceCount} · {OWNER_TYPE_LABELS[group.ownerType]}
            </span>
          </span>
        ))}
        {distribution.unknownCount > 0 && (
          <span className="text-white/40">
            {distribution.unknownCount} unknown
          </span>
        )}
      </div>
    </section>
  )
}

function buildHeadline({
  dominantOwner,
  groups,
  total,
}: {
  dominantOwner: ReturnType<typeof computeOwnershipDistribution>['dominantOwner']
  groups: ReturnType<typeof computeOwnershipDistribution>['groups']
  total: number
}): string {
  if (dominantOwner) {
    return `${dominantOwner.ownerName} covers ${dominantOwner.sourceCount} of ${total} sources on this story.`
  }
  if (groups.length === 1) {
    return `${groups[0].ownerName} is the only named owner among ${total} sources on this story.`
  }
  return `Coverage spans ${groups.length} owners across ${total} sources on this story.`
}
