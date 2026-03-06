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

  const trackBar = showLabels ? (
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-white/50 min-w-[28px] text-right tabular-nums">
        {Math.round(leftPct)}%
      </span>
      <div className="flex-1">
        <div className="spectrum-track">
          {bar}
        </div>
      </div>
      <span className="text-xs text-white/50 min-w-[28px] tabular-nums">
        {Math.round(rightPct)}%
      </span>
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
