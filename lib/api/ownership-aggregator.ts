/**
 * lib/api/ownership-aggregator.ts — Pure function to compute ownership distribution
 * for a set of sources covering a story.
 *
 * Given the sources list for a story, groups them by owner and produces:
 *   - Per-owner group with count + percentage (share of *total* sources, so
 *     group percentages + unknown share stack to 100% for the UI bar)
 *   - unknownCount: sources with no owner_id
 *   - concentrationIndex: HHI / 10000 over integer percent shares (0..1),
 *     summed across named owners plus the unknown slice
 *   - dominantOwner: the single owner with >= 50% share of *all* sources, else null
 */

import type { MediaOwner, NewsSource, OwnerType } from '@/lib/types'

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

function bucketize(
  sources: readonly NewsSource[]
): { known: Map<string, { owner: MediaOwner; count: number }>; unknownCount: number } {
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
      // Rounded integer percentage is for display only (bar widths, chips).
      // Dominance + HHI use raw counts / exact fractions below so we don't
      // promote a 49.5%-share owner to "dominant" via Math.round(49.5)=50.
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) =>
      b.sourceCount !== a.sourceCount
        ? b.sourceCount - a.sourceCount
        : a.ownerName.localeCompare(b.ownerName)
    )

  // Herfindahl-Hirschman Index — sum of squared *exact* market shares,
  // including the unknown slice as its own "owner" so unfragmented datasets
  // aren't penalized. Divisor is 1 since fractional shares sum to 1.
  const groupHhi = groups.reduce((sum, g) => {
    const share = g.sourceCount / total
    return sum + share * share
  }, 0)
  const unknownShare = unknownCount / total
  const concentrationIndex = Math.min(1, groupHhi + unknownShare * unknownShare)

  // Dominance threshold operates on raw counts: a strict majority (>= 50%)
  // means `count * 2 >= total`. This avoids rounding bugs at the boundary.
  const lead = groups[0]
  const dominantOwner = lead.sourceCount * 2 >= total ? lead : null

  return {
    groups,
    unknownCount,
    concentrationIndex,
    dominantOwner,
  }
}
