/**
 * components/atoms/MomentumBadge.tsx — Narrative phase badge for stories.
 *
 * Shows the story's current narrative phase (Breaking, Developing, Analysis, Aftermath)
 * as a color-coded pill badge. Derived from story velocity data.
 */

import type { NarrativePhase } from '@/lib/types'

interface Props {
  readonly phase: NarrativePhase
}

const PHASE_CONFIG: Record<NarrativePhase, { label: string; className: string }> = {
  breaking: {
    label: 'BREAKING',
    className: 'bg-red-500/20 border-red-500/30 text-red-300',
  },
  developing: {
    label: 'DEVELOPING',
    className: 'bg-amber-500/20 border-amber-500/30 text-amber-300',
  },
  analysis: {
    label: 'ANALYSIS',
    className: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
  },
  aftermath: {
    label: 'AFTERMATH',
    className: 'bg-zinc-500/20 border-zinc-500/30 text-zinc-400',
  },
}

export function MomentumBadge({ phase }: Props) {
  const config = PHASE_CONFIG[phase]
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-widest uppercase ${config.className}`}
      aria-label={`Story phase: ${config.label}`}
    >
      {config.label}
    </span>
  )
}
