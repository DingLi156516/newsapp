/**
 * components/atoms/BlindspotBadge.tsx — Static badge for blindspot articles.
 *
 * A purely presentational component with no props and no state.
 * Displays a red-gradient pill labeled "BLINDSPOT" to visually flag articles
 * where coverage is politically skewed (>80% from one side of the spectrum).
 *
 * The `spectrum-far-left` class drives the background color (defined in globals.css).
 * The badge is used inside NexusCard whenever `article.isBlindspot === true`.
 */
export function BlindspotBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-widest text-white/90 uppercase spectrum-far-left"
      aria-label="Blindspot story: Coverage is heavily skewed to one side of the political spectrum"
    >
      BLINDSPOT
    </span>
  )
}
