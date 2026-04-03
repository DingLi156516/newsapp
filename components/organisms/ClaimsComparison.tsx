'use client'

/**
 * components/organisms/ClaimsComparison.tsx — Factual claims with dispute indicators.
 *
 * Shows key claims extracted by AI analysis, indicating which side made the claim,
 * whether it's disputed, and any counter-claims.
 */

import type { KeyClaim } from '@/lib/types'

interface Props {
  readonly claims: readonly KeyClaim[]
}

const SIDE_LABELS: Record<string, { label: string; className: string }> = {
  left: { label: 'Left', className: 'bg-blue-500/15 text-blue-300 border-blue-500/25' },
  right: { label: 'Right', className: 'bg-red-500/15 text-red-300 border-red-500/25' },
  both: { label: 'Both', className: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/25' },
}

export function ClaimsComparison({ claims }: Props) {
  if (claims.length === 0) return null

  return (
    <section className="glass overflow-hidden" aria-label="Key claims comparison">
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white/90 tracking-wide uppercase">
          Key Claims
        </h3>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {claims.map((claim, i) => {
          const sideConfig = SIDE_LABELS[claim.side] ?? SIDE_LABELS.both
          return (
            <div key={i} className="px-5 py-4 space-y-2">
              <div className="flex items-start gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${sideConfig.className}`}
                >
                  {sideConfig.label}
                </span>
                {claim.disputed && (
                  <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-amber-300 uppercase">
                    DISPUTED
                  </span>
                )}
              </div>
              <p className="text-sm text-white/80 leading-relaxed">{claim.claim}</p>
              {claim.counterClaim && (
                <div className="pl-3 border-l-2 border-white/10">
                  <p className="text-xs text-white/50 leading-relaxed">
                    <span className="font-medium text-white/60">Counter:</span>{' '}
                    {claim.counterClaim}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
