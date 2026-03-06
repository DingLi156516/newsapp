/**
 * components/atoms/CoverageCount.tsx — Shows how many outlets covered a story.
 *
 * A simple display component that renders a pill badge with a newspaper icon
 * and a number (e.g., "43 sources"). Accepts the count as a prop and has
 * no internal state — pure output component.
 *
 * The `glass-pill` CSS class (defined in globals.css) applies the frosted-glass
 * pill styling shared across many small badge elements in the UI.
 */
import { Newspaper } from 'lucide-react'

interface Props {
  count: number  // Total number of outlets that covered this story
}

export function CoverageCount({ count }: Props) {
  return (
    <span className="glass-pill inline-flex items-center gap-1 px-2.5 py-1 text-xs text-white/80">
      {/* Lucide is an icon library — Newspaper renders as an SVG icon */}
      <Newspaper size={11} strokeWidth={1.5} />
      <span>{count} sources</span>
    </span>
  )
}
