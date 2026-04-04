/**
 * components/atoms/ScoreBar.tsx — Horizontal bar gauge with fill.
 */
'use client'

import { motion } from 'framer-motion'

interface Props {
  readonly label: string
  readonly value: number
  readonly max?: number
  readonly color: string
}

export function ScoreBar({ label, value, max = 100, color }: Props) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span className="text-white/80 tabular-nums">
          {Number.isInteger(value) ? value : value.toFixed(1)}{max !== 100 ? `/${max}` : ''}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
