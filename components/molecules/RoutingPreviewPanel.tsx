'use client'

/**
 * components/molecules/RoutingPreviewPanel.tsx — Admin-only panel
 * showing which assembly path (`rich | single | thin`) the pipeline
 * would choose for a given story, plus the thresholds and any mode
 * override. Helps operators understand why a stuck story has null
 * sentiment/quotes before deciding to approve-as-is vs. edit.
 */

import type { BiasCategory } from '@/lib/types'
import type { RoutingPreview } from '@/lib/hooks/use-routing-preview'

const LEFT_BIAS_SET: ReadonlySet<BiasCategory> = new Set<BiasCategory>([
  'far-left',
  'left',
  'lean-left',
])
const RIGHT_BIAS_SET: ReadonlySet<BiasCategory> = new Set<BiasCategory>([
  'lean-right',
  'right',
  'far-right',
])

interface Props {
  readonly preview: RoutingPreview | null
  readonly isLoading: boolean
  readonly error?: unknown
}

const PATH_LABELS: Record<RoutingPreview['assemblyPath'], string> = {
  rich: 'Rich (Gemini)',
  single: 'Single-source',
  thin: 'Thin (deterministic)',
}

const PATH_CLASSES: Record<RoutingPreview['assemblyPath'], string> = {
  rich: 'text-emerald-300',
  single: 'text-sky-300',
  thin: 'text-amber-300',
}

function formatBuckets(biases: readonly BiasCategory[], count: number): string {
  if (count === 0) return 'none'
  const hasLeft = biases.some((b) => LEFT_BIAS_SET.has(b))
  const hasCenter = biases.some((b) => b === 'center')
  const hasRight = biases.some((b) => RIGHT_BIAS_SET.has(b))
  const labels: string[] = []
  if (hasLeft) labels.push('L')
  if (hasCenter) labels.push('C')
  if (hasRight) labels.push('R')
  return `${count}/3 (${labels.join(' · ')})`
}

export function RoutingPreviewPanel({ preview, isLoading, error }: Props) {
  if (isLoading) {
    return (
      <div
        data-testid="routing-preview-panel"
        className="glass-sm rounded-xl p-4 text-xs text-white/40"
      >
        Loading routing preview…
      </div>
    )
  }

  if (error) {
    return (
      <div
        data-testid="routing-preview-panel"
        className="glass-sm rounded-xl p-4 text-xs text-red-300"
      >
        Failed to load routing preview.
      </div>
    )
  }

  if (!preview) return null

  const {
    sourceCount,
    assemblyPath,
    distinctBiasBuckets,
    biases,
    appliedThresholds,
  } = preview
  const { minSources, minBuckets, modeOverride } = appliedThresholds

  return (
    <section
      data-testid="routing-preview-panel"
      className="glass-sm rounded-xl p-4 text-xs"
      aria-label="Assembly routing preview"
    >
      <header className="mb-3 text-[10px] uppercase tracking-wide text-white/40">
        Assembly routing
      </header>
      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 text-white/80">
        <dt className="text-white/40">Path:</dt>
        <dd className={`font-semibold ${PATH_CLASSES[assemblyPath]}`}>
          {PATH_LABELS[assemblyPath]}
        </dd>

        <dt className="text-white/40">Sources:</dt>
        <dd>{sourceCount}</dd>

        <dt className="text-white/40">Bias buckets:</dt>
        <dd>{formatBuckets(biases, distinctBiasBuckets)}</dd>

        <dt className="text-white/40">Thresholds:</dt>
        <dd>
          ≥{minSources} sources · ≥{minBuckets} buckets
        </dd>

        <dt className="text-white/40">Mode override:</dt>
        <dd>{modeOverride ?? 'none'}</dd>
      </dl>
    </section>
  )
}
