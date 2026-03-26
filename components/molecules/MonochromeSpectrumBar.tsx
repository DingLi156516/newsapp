'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import type { SpectrumSegment, BiasCategory } from '@/lib/types'
import { BIAS_CSS_CLASS } from '@/lib/types'
import { BiasLegend } from './BiasLegend'

interface Props {
  segments: SpectrumSegment[]
  showLegend?: boolean
  showLabels?: boolean
  height?: 'sm' | 'md'
}

function largestRemainderRound(values: number[]): number[] {
  const floored = values.map(Math.floor)
  const remainders = values.map((v, i) => v - floored[i])
  let remaining = 100 - floored.reduce((a, b) => a + b, 0)

  const indices = remainders
    .map((r, i) => ({ i, r }))
    .sort((a, b) => b.r - a.r)
    .map((x) => x.i)

  const result = [...floored]
  for (const idx of indices) {
    if (remaining <= 0) break
    result[idx] += 1
    remaining -= 1
  }
  return result
}

const leftBiases: BiasCategory[] = ['far-left', 'left', 'lean-left']
const rightBiases: BiasCategory[] = ['lean-right', 'right', 'far-right']

export function MonochromeSpectrumBar({
  segments,
  showLegend = false,
  showLabels = false,
  height = 'md',
}: Props) {
  const [legendOpen, setLegendOpen] = useState(false)
  const heightPx = height === 'sm' ? 4 : 8

  const activeSegments = segments.filter((s) => s.percentage > 0)

  const leftPct = segments
    .filter(s => leftBiases.includes(s.bias))
    .reduce((sum, s) => sum + s.percentage, 0)
  const centerPct = segments
    .filter(s => s.bias === 'center')
    .reduce((sum, s) => sum + s.percentage, 0)
  const rightPct = segments
    .filter(s => rightBiases.includes(s.bias))
    .reduce((sum, s) => sum + s.percentage, 0)

  const bar = (
    <div
      className="flex w-full overflow-hidden rounded-full"
      style={{ height: `${heightPx}px` }}
      role="img"
      aria-label="Source bias distribution"
    >
      {activeSegments.map((segment) => (
        <div
          key={segment.bias}
          className={BIAS_CSS_CLASS[segment.bias]}
          style={{ width: `${segment.percentage}%` }}
          title={`${segment.bias}: ${segment.percentage}%`}
        />
      ))}
    </div>
  )

  const [roundedLeft, roundedCenter, roundedRight] = largestRemainderRound([
    leftPct,
    centerPct,
    rightPct,
  ])

  const trackBar = showLabels ? (
    <div>
      <div className="spectrum-track">
        {bar}
      </div>
      <div className="flex justify-between mt-1">
        {roundedLeft > 0 && (
          <span className="text-xs text-white/50 tabular-nums">Left {roundedLeft}%</span>
        )}
        {roundedCenter > 0 && (
          <span className="text-xs text-white/50 tabular-nums">Center {roundedCenter}%</span>
        )}
        {roundedRight > 0 && (
          <span className="text-xs text-white/50 tabular-nums">Right {roundedRight}%</span>
        )}
      </div>
    </div>
  ) : (
    <div className="spectrum-track">
      {bar}
    </div>
  )

  return (
    <div className="relative flex items-center gap-2">
      <div className="flex-1">
        {trackBar}
      </div>

      {showLegend && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setLegendOpen((prev) => !prev)}
            className="flex items-center justify-center rounded-full p-0.5 text-white/60 transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
            aria-label="Show bias pattern legend"
            aria-expanded={legendOpen}
          >
            <Info size={14} />
          </button>
          {legendOpen && (
            <BiasLegend onClose={() => setLegendOpen(false)} />
          )}
        </div>
      )}
    </div>
  )
}
