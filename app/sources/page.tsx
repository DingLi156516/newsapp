/**
 * app/sources/page.tsx — Source directory page (route: "/sources").
 *
 * A searchable, filterable directory of all news outlets in the system.
 * This page demonstrates multi-filter state management with Sets:
 *   - `selectedBiases`    — A Set<BiasCategory>; empty = no bias filter
 *   - `selectedFactuality` — A Set<FactualityLevel>; empty = no factuality filter
 *
 * Using Sets for multi-select filters (rather than arrays) gives O(1) `.has()` checks
 * when rendering each source card to determine if it's filtered in/out.
 *
 * Filter logic in `filtered` (useMemo):
 *   1. Text search: case-insensitive match on source name
 *   2. Bias filter: source.bias must be in selectedBiases (if any selected)
 *   3. Factuality filter: source.factuality must be in selectedFactuality (if any selected)
 *   Filters compound: a source must pass ALL active filters to be shown.
 *
 * The toggle functions follow the immutable update pattern used throughout this app:
 * always create a new Set copy with `new Set(prev)` before modifying it, because
 * React only triggers re-renders when state references change (mutating in place won't work).
 */
'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import type { BiasCategory, FactualityLevel } from '@/lib/types'
import { BIAS_LABELS, FACTUALITY_LABELS, OWNERSHIP_LABELS } from '@/lib/types'
import { useSources } from '@/lib/hooks/use-sources'
import { BiasTag } from '@/components/atoms/BiasTag'
import { FactualityDots } from '@/components/atoms/FactualityDots'
import { Skeleton } from '@/components/atoms/Skeleton'
import { SearchBar } from '@/components/organisms/SearchBar'
import { UserMenu } from '@/components/organisms/UserMenu'

/** All available bias options for filter pills — ordered left to right */
const ALL_BIASES: BiasCategory[] = [
  'far-left', 'left', 'lean-left', 'center', 'lean-right', 'right', 'far-right',
]
/** All available factuality levels for filter pills — ordered best to worst */
const ALL_FACTUALITY: FactualityLevel[] = [
  'very-high', 'high', 'mixed', 'low', 'very-low',
]

export default function SourcesPage() {
  const router = useRouter()

  /** Text search query */
  const [search, setSearch] = useState('')

  /**
   * Multi-select bias filter. A source must match one of the selected biases
   * to be shown (OR logic within the set, AND logic across filter types).
   * Empty Set = no filter active (show all biases).
   */
  const [selectedBiases, setSelectedBiases] = useState<Set<BiasCategory>>(new Set())

  /**
   * Multi-select factuality filter. Same OR-within/AND-across logic.
   * Empty Set = no filter active.
   */
  const [selectedFactuality, setSelectedFactuality] = useState<Set<FactualityLevel>>(new Set())

  /**
   * Toggles a bias value into/out of the selectedBiases Set.
   * If the value is already in the Set, it's removed (deselect).
   * If not, it's added (select).
   * Always creates a new Set copy to ensure React detects the state change.
   */
  function toggleBias(bias: BiasCategory) {
    setSelectedBiases((prev) => {
      const next = new Set(prev)
      if (next.has(bias)) next.delete(bias)
      else next.add(bias)
      return next
    })
  }

  /** Same toggle logic applied to the factuality filter Set */
  function toggleFactuality(level: FactualityLevel) {
    setSelectedFactuality((prev) => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }

  // Fetch sources from API, falls back to sample data.
  const { sources: allSources, isLoading } = useSources({ search: search.trim() || undefined })

  // Client-side multi-select filtering for bias/factuality.
  const filtered = useMemo(() => {
    return allSources.filter((source) => {
      if (selectedBiases.size > 0 && !selectedBiases.has(source.bias)) return false
      if (selectedFactuality.size > 0 && !selectedFactuality.has(source.factuality)) return false
      return true
    })
  }, [allSources, selectedBiases, selectedFactuality])

  return (
    <div className="min-h-screen mesh-gradient">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Header row: back button + page title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft size={14} />
              Feed
            </button>
            <h1
              className="text-2xl font-bold text-white"
              style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
            >
              Source Directory
            </h1>
          </div>
          <UserMenu />
        </div>

        {/* Search input */}
        <SearchBar
          value={search}
          onChange={setSearch}
          onClear={() => setSearch('')}
          placeholder="Search sources…"
        />

        {/* Bias filter pills — multi-select, active = highlighted pill */}
        <div className="space-y-2">
          <p className="text-xs text-white/60 uppercase tracking-widest">Filter by Bias</p>
          <div className="flex flex-wrap gap-2">
            {ALL_BIASES.map((bias) => (
              <button
                key={bias}
                onClick={() => toggleBias(bias)}
                className={`flex items-center gap-2 glass-pill px-3 py-1.5 text-xs transition-colors ${
                  // Conditional class: whiter text + visible border when this bias is selected
                  selectedBiases.has(bias)
                    ? 'text-white border-white/30'
                    : 'text-white/70'
                }`}
                aria-pressed={selectedBiases.has(bias)}
              >
                <BiasTag bias={bias} size="xs" />
                {BIAS_LABELS[bias]}
              </button>
            ))}
          </div>
        </div>

        {/* Factuality filter pills — multi-select */}
        <div className="space-y-2">
          <p className="text-xs text-white/60 uppercase tracking-widest">Filter by Factuality</p>
          <div className="flex flex-wrap gap-2">
            {ALL_FACTUALITY.map((level) => (
              <button
                key={level}
                onClick={() => toggleFactuality(level)}
                className={`flex items-center gap-2 glass-pill px-3 py-1.5 text-xs transition-colors ${
                  selectedFactuality.has(level)
                    ? 'text-white border-white/30'
                    : 'text-white/70'
                }`}
                aria-pressed={selectedFactuality.has(level)}
              >
                <FactualityDots level={level} />
                {FACTUALITY_LABELS[level]}
              </button>
            ))}
          </div>
        </div>

        {/* Source grid */}
        <div className="space-y-2">
          <p className="text-xs text-white/60">
            {isLoading ? 'Loading…' : `${filtered.length} source${filtered.length !== 1 ? 's' : ''}`}
          </p>
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="glass-sm p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((source) => (
              <div key={source.id} className="glass-sm p-4 space-y-3">
                {/* Top row: bias dot + name (left), factuality dots (right) */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BiasTag bias={source.bias} size="sm" />
                    <span className="font-medium text-white text-sm">{source.name}</span>
                  </div>
                  <FactualityDots level={source.factuality} />
                </div>
                {/* Bottom row: bias label (left), ownership type (right) */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">{BIAS_LABELS[source.bias]}</span>
                  <span className="text-xs text-white/60">{OWNERSHIP_LABELS[source.ownership]}</span>
                </div>
                {/* External link to the source's website (if URL is defined) */}
                {source.url && (
                  <a
                    href={`https://${source.url}`}
                    target="_blank"
                    rel="noopener noreferrer"  // Security: prevents the new tab accessing window.opener
                    className="text-xs text-white/50 hover:text-white/70 transition-colors"
                  >
                    {source.url} ↗
                  </a>
                )}
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
