/**
 * components/atoms/Skeleton.tsx — Animated loading placeholder.
 *
 * Renders a pulsing glass-effect block at specified width/height.
 * Used to build skeleton loading states for cards and detail pages.
 */

interface SkeletonProps {
  readonly className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}
