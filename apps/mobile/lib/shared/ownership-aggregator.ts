/**
 * apps/mobile/lib/shared/ownership-aggregator.ts — Mobile mirror of
 * web lib/api/ownership-aggregator.ts. Kept in sync by hand; logic is
 * small and stable, so duplication beats dragging lib/api into Expo bundle.
 */

import type { MediaOwner, NewsSource, OwnerType } from '@/lib/shared/types'

export interface OwnershipGroup {
  readonly ownerId: string
  readonly ownerName: string
  readonly ownerSlug: string
  readonly ownerType: OwnerType
  readonly isIndividual: boolean
  readonly country: string | null
  readonly sourceCount: number
  readonly percentage: number
}

export interface OwnershipDistribution {
  readonly groups: readonly OwnershipGroup[]
  readonly unknownCount: number
  readonly concentrationIndex: number
  readonly dominantOwner: OwnershipGroup | null
}

function bucketize(sources: readonly NewsSource[]): {
  known: Map<string, { owner: MediaOwner; count: number }>
  unknownCount: number
} {
  const known = new Map<string, { owner: MediaOwner; count: number }>()
  let unknownCount = 0

  for (const source of sources) {
    if (!source.owner) {
      unknownCount += 1
      continue
    }
    const existing = known.get(source.owner.id)
    if (existing) {
      known.set(source.owner.id, { owner: existing.owner, count: existing.count + 1 })
    } else {
      known.set(source.owner.id, { owner: source.owner, count: 1 })
    }
  }

  return { known, unknownCount }
}

export function computeOwnershipDistribution(
  sources: readonly NewsSource[]
): OwnershipDistribution {
  const { known, unknownCount } = bucketize(sources)

  if (known.size === 0) {
    return {
      groups: [],
      unknownCount,
      concentrationIndex: 0,
      dominantOwner: null,
    }
  }

  const total = sources.length

  const groups: OwnershipGroup[] = [...known.values()]
    .map(({ owner, count }) => ({
      ownerId: owner.id,
      ownerName: owner.name,
      ownerSlug: owner.slug,
      ownerType: owner.ownerType,
      isIndividual: owner.isIndividual,
      country: owner.country,
      sourceCount: count,
      // Rounded integer percentage is for display only. Dominance + HHI use
      // raw counts / exact fractions below.
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) =>
      b.sourceCount !== a.sourceCount
        ? b.sourceCount - a.sourceCount
        : a.ownerName.localeCompare(b.ownerName)
    )

  const groupHhi = groups.reduce((sum, g) => {
    const share = g.sourceCount / total
    return sum + share * share
  }, 0)
  const unknownShare = unknownCount / total
  const concentrationIndex = Math.min(1, groupHhi + unknownShare * unknownShare)

  const lead = groups[0]
  const dominantOwner = lead.sourceCount * 2 >= total ? lead : null

  return { groups, unknownCount, concentrationIndex, dominantOwner }
}
