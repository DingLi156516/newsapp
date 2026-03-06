/**
 * lib/ai/spectrum-calculator.ts — Political spectrum distribution calculator.
 *
 * Computes the spectrum segment percentages for a story based on the
 * bias ratings of its covering sources.
 */

import type { BiasCategory, SpectrumSegment } from '@/lib/types'

const BIAS_ORDER: readonly BiasCategory[] = [
  'far-left', 'left', 'lean-left', 'center', 'lean-right', 'right', 'far-right',
]

export function calculateSpectrum(
  sourceBiases: readonly BiasCategory[]
): SpectrumSegment[] {
  if (sourceBiases.length === 0) {
    return []
  }

  const counts = new Map<BiasCategory, number>()

  for (const bias of sourceBiases) {
    counts.set(bias, (counts.get(bias) ?? 0) + 1)
  }

  const total = sourceBiases.length

  return BIAS_ORDER
    .filter((bias) => counts.has(bias))
    .map((bias) => ({
      bias,
      percentage: Math.round((counts.get(bias)! / total) * 100),
    }))
}
