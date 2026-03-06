/**
 * components/atoms/FactualityDots.tsx — Visual factuality rating as a 5-dot scale.
 *
 * Renders up to 5 dots, filled white for the factuality score and hollow for
 * the remainder. Think of it like a 5-star rating widget but for source reliability.
 *
 * Scoring: very-high = 5 filled, high = 4, mixed = 3, low = 2, very-low = 1.
 *
 * The `LEVEL_COUNTS` lookup table maps each FactualityLevel to an integer so
 * we don't need a switch/if-else — just `LEVEL_COUNTS[level]` returns the count.
 *
 * Props:
 *   level       — The factuality rating to display.
 *   showLabel   — If true, appends a text label like "High Factuality" after the dots.
 */
import type { FactualityLevel } from '@/lib/types'
import { FACTUALITY_LABELS } from '@/lib/types'

interface Props {
  level: FactualityLevel
  showLabel?: boolean
}

/**
 * Maps each factuality level to the number of filled dots (1–5).
 * Defined at module scope so it's only created once, not on every render.
 */
const LEVEL_COUNTS: Record<FactualityLevel, number> = {
  'very-high': 5,
  'high': 4,
  'mixed': 3,
  'low': 2,
  'very-low': 1,
}

export function FactualityDots({ level, showLabel = false }: Props) {
  const filledCount = LEVEL_COUNTS[level]

  return (
    <span className="flex items-center gap-1.5" title={FACTUALITY_LABELS[level]}>
      <span className="flex items-center gap-0.5" aria-label={`Factuality: ${FACTUALITY_LABELS[level]}`}>
        {/*
          Array.from({ length: 5 }, (_, i) => ...) is equivalent to a for loop
          that generates 5 elements. The `_` is a convention for an unused
          parameter (the array value); `i` is the 0-based index.
        */}
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            // All color/opacity via Tailwind — filled dots are white, empty dots are hollow outlines
            className={`inline-block w-2 h-2 rounded-full ${
              i < filledCount
                ? 'bg-white/80'
                : 'bg-transparent border border-white/20'
            }`}
          />
        ))}
      </span>
      {/* Conditionally rendered text label (shown on the story detail page) */}
      {showLabel && (
        <span className="text-xs text-white/70">{FACTUALITY_LABELS[level]}</span>
      )}
    </span>
  )
}
