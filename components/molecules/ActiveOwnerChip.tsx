/**
 * components/molecules/ActiveOwnerChip.tsx — Visible pill shown above the feed
 * when a `?owner=…` filter is active. Renders a title-cased display of the
 * slug plus an × to clear.
 *
 * The slug-to-display fallback (`warner-bros-discovery` → `Warner Bros Discovery`)
 * keeps the chip self-contained — no extra fetch required to show useful text.
 * When a proper `/api/owners/[slug]` lookup lands, pass the real name via the
 * optional `displayName` prop to override the fallback.
 */
'use client'

import { Building2, X } from 'lucide-react'

interface Props {
  readonly slug: string
  readonly displayName?: string
  readonly onClear: () => void
}

export function formatOwnerSlugForDisplay(slug: string): string {
  return slug
    .split('-')
    .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join(' ')
}

export function ActiveOwnerChip({ slug, displayName, onClear }: Props) {
  const label = displayName ?? formatOwnerSlugForDisplay(slug)
  return (
    <div
      data-testid="active-owner-chip"
      className="glass-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/80"
    >
      <Building2 size={12} className="text-white/50" />
      <span className="text-white/50">Owner:</span>
      <span className="font-medium text-white">{label}</span>
      <button
        data-testid="active-owner-chip-clear"
        onClick={onClear}
        aria-label={`Clear owner filter ${label}`}
        className="ml-1 text-white/40 hover:text-white transition-colors"
      >
        <X size={12} />
      </button>
    </div>
  )
}
