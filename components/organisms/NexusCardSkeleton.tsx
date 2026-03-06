/**
 * components/organisms/NexusCardSkeleton.tsx — Loading skeleton for NexusCard.
 *
 * Mimics the layout of a NexusCard with pulsing placeholders for:
 * image, headline, spectrum bar, metadata badges.
 */

import { Skeleton } from '@/components/atoms/Skeleton'

export function NexusCardSkeleton() {
  return (
    <div className="glass overflow-hidden" role="status" aria-label="Loading story">
      {/* Image placeholder */}
      <Skeleton className="h-40 rounded-none" />

      <div className="p-4 space-y-3">
        {/* Headline lines */}
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />

        {/* Spectrum bar */}
        <Skeleton className="h-2 w-full" />

        {/* Metadata row */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-12 ml-auto" />
        </div>
      </div>
    </div>
  )
}

export function NexusCardSkeletonList({
  count = 3,
  layout = 'list',
}: {
  readonly count?: number
  readonly layout?: 'list' | 'bento'
}) {
  const gridClass = layout === 'bento'
    ? 'grid gap-2 sm:grid-cols-2'
    : 'grid gap-4 sm:grid-cols-1'

  return (
    <div className={gridClass}>
      {Array.from({ length: count }, (_, i) => (
        <NexusCardSkeleton key={i} />
      ))}
    </div>
  )
}
