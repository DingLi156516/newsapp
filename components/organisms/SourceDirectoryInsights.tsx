'use client'

import type { NewsSource } from '@/lib/types'
import { OWNERSHIP_LABELS, REGION_LABELS } from '@/lib/types'

interface Props {
  readonly sources: NewsSource[]
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function SourceDirectoryInsights({ sources }: Props) {
  const ownershipCounts = new Map<string, number>()
  const regions = new Set<string>()

  for (const source of sources) {
    ownershipCounts.set(source.ownership, (ownershipCounts.get(source.ownership) ?? 0) + 1)
    regions.add(source.region)
  }

  const leadingOwnership = [...ownershipCounts.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0]

  const regionsSummary = [...regions]
    .map((region) => REGION_LABELS[region as keyof typeof REGION_LABELS])
    .join(', ')

  return (
    <div className="glass p-4 space-y-2">
      <p className="text-sm text-white/80">
        {pluralize(sources.length, 'active source')} in this directory.
      </p>
      <p className="text-sm text-white/65">
        {leadingOwnership
          ? `Ownership is led by ${OWNERSHIP_LABELS[leadingOwnership as keyof typeof OWNERSHIP_LABELS].toLowerCase()} outlets in the current view.`
          : 'Ownership mix will appear here as sources load.'}
      </p>
      <p className="text-xs text-white/45">
        Regions represented: {regionsSummary || 'None'}.
      </p>
    </div>
  )
}
