import type { FactualityLevel } from '@/lib/types'
import { FACTUALITY, FACTUALITY_LABELS } from '@/lib/types'

interface FactualityBarProps {
  readonly level: FactualityLevel
  readonly size?: 'default' | 'compact'
  readonly showLabel?: boolean
}

const SIZES = {
  default: { width: 40, height: 4 },
  compact: { width: 28, height: 3 },
} as const

export function FactualityBar({ level, size = 'default', showLabel = false }: FactualityBarProps) {
  const token = FACTUALITY[level]
  const { width, height } = SIZES[size]

  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`Factuality: ${FACTUALITY_LABELS[level]}`}>
      <span
        className="relative rounded-full overflow-hidden bg-white/[0.06]"
        style={{ width, height }}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${token.fill * 100}%`,
            backgroundColor: token.color,
          }}
        />
      </span>
      {showLabel && (
        <span className="text-xs" style={{ color: token.color }}>
          {FACTUALITY_LABELS[level]}
        </span>
      )}
    </span>
  )
}
