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
      className={`rounded-lg bg-gradient-to-r from-white/[0.04] via-white/[0.10] to-white/[0.04] bg-[length:200%_100%] animate-shimmer ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}
