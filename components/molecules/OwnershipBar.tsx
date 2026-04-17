/**
 * components/molecules/OwnershipBar.tsx — Horizontal segmented bar showing
 * proportional ownership of a story's sources.
 *
 * Each segment is one owner; width is proportional to source share. Color is
 * driven by ownerType so the same conglomerate keeps the same tone across stories.
 * A trailing "unknown" slice is rendered when there are sources with no owner_id.
 */
'use client'

import type { OwnershipDistribution, OwnershipGroup } from '@/lib/api/ownership-aggregator'
import type { OwnerType } from '@/lib/types'

const OWNER_TYPE_COLOR: Record<OwnerType, string> = {
  public_company: 'bg-slate-400/80',
  private_company: 'bg-zinc-400/80',
  cooperative: 'bg-teal-400/80',
  public_broadcaster: 'bg-sky-400/80',
  trust: 'bg-indigo-400/80',
  individual: 'bg-amber-400/80',
  state_adjacent: 'bg-rose-400/80',
  nonprofit: 'bg-emerald-400/80',
}

interface Props {
  readonly distribution: OwnershipDistribution
  readonly totalSources: number
}

function segmentLabel(group: OwnershipGroup): string {
  const plural = group.sourceCount === 1 ? 'source' : 'sources'
  return `${group.ownerName} · ${group.sourceCount} ${plural}`
}

export function OwnershipBar({ distribution, totalSources }: Props) {
  if (totalSources <= 0) return null

  // Derive segment widths from raw counts so 3-owner 1/1/1 stories don't
  // render a phantom "1% unknown" slice via rounded 33+33+33 = 99 math.
  // The unknown segment renders iff unknownCount > 0 (count-gated, not math).
  const widthFor = (count: number) => (count / totalSources) * 100

  return (
    <div
      className="flex w-full overflow-hidden rounded-full bg-white/[0.04]"
      style={{ height: '10px' }}
      role="img"
      aria-label="Ownership distribution of sources"
      data-testid="ownership-bar"
    >
      {distribution.groups.map((group) => (
        <div
          key={group.ownerId}
          data-testid={`ownership-segment-${group.ownerSlug}`}
          className={`${OWNER_TYPE_COLOR[group.ownerType]} transition-opacity hover:opacity-100`}
          style={{ width: `${widthFor(group.sourceCount)}%` }}
          title={segmentLabel(group)}
          aria-label={segmentLabel(group)}
        />
      ))}
      {distribution.unknownCount > 0 && (
        <div
          data-testid="ownership-segment-unknown"
          className="bg-white/10"
          style={{ width: `${widthFor(distribution.unknownCount)}%` }}
          title={`${distribution.unknownCount} source${distribution.unknownCount === 1 ? '' : 's'} without ownership data`}
          aria-label="Unknown ownership"
        />
      )}
    </div>
  )
}
