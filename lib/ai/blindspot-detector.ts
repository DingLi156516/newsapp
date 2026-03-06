/**
 * lib/ai/blindspot-detector.ts — Coverage blindspot detection.
 *
 * A story is a "blindspot" when coverage is heavily skewed to one side
 * of the political spectrum (>80% from left or right sources).
 */

import type { BiasCategory, SpectrumSegment } from '@/lib/types'

const LEFT_BIASES: ReadonlySet<BiasCategory> = new Set([
  'far-left', 'left', 'lean-left',
])

const RIGHT_BIASES: ReadonlySet<BiasCategory> = new Set([
  'lean-right', 'right', 'far-right',
])

const BLINDSPOT_THRESHOLD = 80

export function isBlindspot(segments: readonly SpectrumSegment[]): boolean {
  if (segments.length === 0) return false

  let leftPercentage = 0
  let rightPercentage = 0

  for (const segment of segments) {
    if (LEFT_BIASES.has(segment.bias)) {
      leftPercentage += segment.percentage
    } else if (RIGHT_BIASES.has(segment.bias)) {
      rightPercentage += segment.percentage
    }
  }

  return leftPercentage >= BLINDSPOT_THRESHOLD || rightPercentage >= BLINDSPOT_THRESHOLD
}
