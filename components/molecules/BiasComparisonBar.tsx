/**
 * components/molecules/BiasComparisonBar.tsx — Side-by-side spectrum bars.
 *
 * Shows user's bias distribution vs overall distribution for comparison.
 */
'use client'

import { BIAS_CSS_CLASS, BIAS_LABELS } from '@/lib/types'
import type { BiasDistribution } from '@/lib/api/bias-calculator'

interface Props {
  readonly label: string
  readonly distribution: readonly BiasDistribution[]
}

function SingleBar({ label, distribution }: Props) {
  const active = distribution.filter((d) => d.percentage > 0)

  return (
    <div className="space-y-1">
      <span className="text-xs text-white/50">{label}</span>
      <div
        className="flex w-full overflow-hidden rounded-full"
        style={{ height: '8px' }}
        role="img"
        aria-label={`${label} bias distribution`}
      >
        {active.map((segment) => (
          <div
            key={segment.bias}
            className={BIAS_CSS_CLASS[segment.bias]}
            style={{ width: `${segment.percentage}%` }}
            title={`${BIAS_LABELS[segment.bias]}: ${segment.percentage}%`}
          />
        ))}
      </div>
    </div>
  )
}

interface ComparisonProps {
  readonly userDistribution: readonly BiasDistribution[]
  readonly overallDistribution: readonly BiasDistribution[]
}

export function BiasComparisonBar({ userDistribution, overallDistribution }: ComparisonProps) {
  return (
    <div className="glass p-4 space-y-3">
      <SingleBar label="Your Reading" distribution={userDistribution} />
      <SingleBar label="All Stories" distribution={overallDistribution} />
      <div className="flex justify-between text-[10px] text-white/40 pt-1">
        <span>Far Left</span>
        <span>Center</span>
        <span>Far Right</span>
      </div>
    </div>
  )
}
