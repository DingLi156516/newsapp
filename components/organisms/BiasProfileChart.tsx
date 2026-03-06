/**
 * components/organisms/BiasProfileChart.tsx — User bias distribution visualization.
 *
 * Shows a horizontal bar chart comparing user reading distribution vs overall,
 * with blindspot indicators and dominant bias callout.
 */
'use client'

import { motion } from 'framer-motion'
import { BIAS_CSS_CLASS, BIAS_LABELS } from '@/lib/types'
import type { BiasProfile } from '@/lib/api/bias-calculator'

interface Props {
  readonly profile: BiasProfile
}

export function BiasProfileChart({ profile }: Props) {
  const { userDistribution, overallDistribution, blindspots, dominantBias } = profile
  const blindspotSet = new Set(blindspots)

  return (
    <div className="glass p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/80">Bias Distribution</h3>
        {dominantBias && (
          <span className="glass-pill px-2.5 py-1 text-xs text-white/60">
            Dominant: {BIAS_LABELS[dominantBias]}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {userDistribution.map((item, index) => {
          const overall = overallDistribution.find((o) => o.bias === item.bias)
          const isBlindspot = blindspotSet.has(item.bias)

          return (
            <div key={item.bias} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className={`${isBlindspot ? 'text-amber-400' : 'text-white/70'}`}>
                  {BIAS_LABELS[item.bias]}
                  {isBlindspot && ' (blindspot)'}
                </span>
                <span className="text-white/50 tabular-nums">
                  {item.percentage}% / {overall?.percentage ?? 0}%
                </span>
              </div>
              <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
                {/* Overall distribution (background) */}
                <div
                  className="absolute inset-y-0 left-0 bg-white/10 rounded-full"
                  style={{ width: `${overall?.percentage ?? 0}%` }}
                />
                {/* User distribution (foreground) */}
                <motion.div
                  className={`absolute inset-y-0 left-0 rounded-full ${BIAS_CSS_CLASS[item.bias]}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percentage}%` }}
                  transition={{ duration: 0.6, delay: index * 0.05, ease: 'easeOut' }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 text-[10px] text-white/40 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-white/30" />
          <span>Your reading</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-white/10" />
          <span>All stories</span>
        </div>
      </div>
    </div>
  )
}
