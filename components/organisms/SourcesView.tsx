'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import type { BiasCategory, FactualityLevel, OwnershipType, Region } from '@/lib/types'
import {
  ALL_REGIONS,
  BIAS_COLOR,
  BIAS_LABELS,
  FACTUALITY_LABELS,
  OWNERSHIP_LABELS,
  REGION_LABELS,
} from '@/lib/types'
import { useSources } from '@/lib/hooks/use-sources'
import { BiasTag } from '@/components/atoms/BiasTag'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { SourceLogo } from '@/components/atoms/SourceLogo'
import { Skeleton } from '@/components/atoms/Skeleton'
import { SearchBar } from '@/components/organisms/SearchBar'
import { SourceDirectoryInsights } from '@/components/organisms/SourceDirectoryInsights'

const ALL_BIASES: BiasCategory[] = [
  'far-left', 'left', 'lean-left', 'center', 'lean-right', 'right', 'far-right',
]
const ALL_FACTUALITY: FactualityLevel[] = [
  'very-high', 'high', 'mixed', 'low', 'very-low',
]
const ALL_OWNERSHIPS: OwnershipType[] = [
  'independent', 'corporate', 'private-equity', 'state-funded',
  'telecom', 'government', 'non-profit', 'other',
]

type SortMode = 'name' | 'bias' | 'factuality'

const BIAS_ORDER: Record<BiasCategory, number> = {
  'far-left': 0, 'left': 1, 'lean-left': 2, 'center': 3, 'lean-right': 4, 'right': 5, 'far-right': 6,
}

const FACTUALITY_ORDER: Record<FactualityLevel, number> = {
  'very-high': 0, 'high': 1, 'mixed': 2, 'low': 3, 'very-low': 4,
}

export function SourcesView() {
  const [search, setSearch] = useState('')
  const [selectedBiases, setSelectedBiases] = useState<Set<BiasCategory>>(new Set())
  const [selectedFactuality, setSelectedFactuality] = useState<Set<FactualityLevel>>(new Set())
  const [selectedOwnerships, setSelectedOwnerships] = useState<Set<OwnershipType>>(new Set())
  const [selectedRegions, setSelectedRegions] = useState<Set<Region>>(new Set())
  const [sortMode, setSortMode] = useState<SortMode>('name')

  function toggleBias(bias: BiasCategory) {
    setSelectedBiases((prev) => {
      const next = new Set(prev)
      if (next.has(bias)) next.delete(bias)
      else next.add(bias)
      return next
    })
  }

  function toggleFactuality(level: FactualityLevel) {
    setSelectedFactuality((prev) => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }

  function toggleOwnership(ownership: OwnershipType) {
    setSelectedOwnerships((prev) => {
      const next = new Set(prev)
      if (next.has(ownership)) next.delete(ownership)
      else next.add(ownership)
      return next
    })
  }

  function toggleRegion(region: Region) {
    setSelectedRegions((prev) => {
      const next = new Set(prev)
      if (next.has(region)) next.delete(region)
      else next.add(region)
      return next
    })
  }

  const { sources: allSources, isLoading } = useSources({ search: search.trim() || undefined })

  const filtered = useMemo(() => {
    const list = allSources.filter((source) => {
      if (selectedBiases.size > 0 && !selectedBiases.has(source.bias)) return false
      if (selectedFactuality.size > 0 && !selectedFactuality.has(source.factuality)) return false
      if (selectedOwnerships.size > 0 && !selectedOwnerships.has(source.ownership)) return false
      if (selectedRegions.size > 0 && !selectedRegions.has(source.region)) return false
      return true
    })
    switch (sortMode) {
      case 'bias':
        return [...list].sort((a, b) => BIAS_ORDER[a.bias] - BIAS_ORDER[b.bias])
      case 'factuality':
        return [...list].sort((a, b) => FACTUALITY_ORDER[a.factuality] - FACTUALITY_ORDER[b.factuality])
      default:
        return [...list].sort((a, b) => a.name.localeCompare(b.name))
    }
  }, [allSources, selectedBiases, selectedFactuality, selectedOwnerships, selectedRegions, sortMode])

  return (
    <div className="space-y-6">
      <SearchBar
        value={search}
        onChange={setSearch}
        onClear={() => setSearch('')}
        placeholder="Search sources…"
      />

      <SourceDirectoryInsights sources={filtered} />

      <div className="space-y-2">
        <p className="text-xs text-white/60 uppercase tracking-widest">Filter by Bias</p>
        <div className="flex flex-wrap gap-2">
          {ALL_BIASES.map((bias) => (
            <button
              key={bias}
              onClick={() => toggleBias(bias)}
              className={`flex items-center gap-2 glass-pill px-3 py-1.5 text-xs transition-colors ${
                selectedBiases.has(bias) ? 'text-white border-white/30' : 'text-white/70'
              }`}
              aria-pressed={selectedBiases.has(bias)}
            >
              <BiasTag bias={bias} size="xs" />
              {BIAS_LABELS[bias]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-white/60 uppercase tracking-widest">Filter by Factuality</p>
        <div className="flex flex-wrap gap-2">
          {ALL_FACTUALITY.map((level) => (
            <button
              key={level}
              onClick={() => toggleFactuality(level)}
              className={`flex items-center gap-2 glass-pill px-3 py-1.5 text-xs transition-colors ${
                selectedFactuality.has(level) ? 'text-white border-white/30' : 'text-white/70'
              }`}
              aria-pressed={selectedFactuality.has(level)}
            >
              <FactualityBar level={level} />
              {FACTUALITY_LABELS[level]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-white/60 uppercase tracking-widest">Filter by Ownership</p>
        <div className="flex flex-wrap gap-2">
          {ALL_OWNERSHIPS.map((ownership) => (
            <button
              key={ownership}
              onClick={() => toggleOwnership(ownership)}
              className={`glass-pill px-3 py-1.5 text-xs transition-colors ${
                selectedOwnerships.has(ownership) ? 'text-white border-white/30' : 'text-white/70'
              }`}
              aria-pressed={selectedOwnerships.has(ownership)}
            >
              {OWNERSHIP_LABELS[ownership]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-white/60 uppercase tracking-widest">Filter by Region</p>
        <div className="flex flex-wrap gap-2">
          {ALL_REGIONS.map((region) => (
            <button
              key={region}
              onClick={() => toggleRegion(region)}
              className={`glass-pill px-3 py-1.5 text-xs transition-colors ${
                selectedRegions.has(region) ? 'text-white border-white/30' : 'text-white/70'
              }`}
              aria-pressed={selectedRegions.has(region)}
            >
              {REGION_LABELS[region]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-white/60">
            {isLoading ? 'Loading…' : `${filtered.length} source${filtered.length !== 1 ? 's' : ''}`}
          </p>
          <div className="flex gap-1.5">
            {(['name', 'bias', 'factuality'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={`glass-pill px-2.5 py-1 text-xs transition-colors ${
                  sortMode === mode ? 'text-white border-white/30' : 'text-white/50'
                }`}
                aria-pressed={sortMode === mode}
              >
                {mode === 'name' ? 'A–Z' : mode === 'bias' ? 'Bias' : 'Factuality'}
              </button>
            ))}
          </div>
        </div>
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
              <div
                key={source.id}
                className="glass-sm overflow-hidden flex"
              >
                <div
                  className="w-[3px] flex-shrink-0"
                  style={{ backgroundColor: BIAS_COLOR[source.bias] }}
                />
                <div className="flex-1 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <SourceLogo domain={source.url} name={source.name} bias={source.bias} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-white text-sm truncate">{source.name}</span>
                        <FactualityBar level={source.factuality} />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white/90"
                          style={{ backgroundColor: `${BIAS_COLOR[source.bias]}1A` }}
                        >
                          {BIAS_LABELS[source.bias]}
                        </span>
                        <span className="text-xs text-white/50">{OWNERSHIP_LABELS[source.ownership]}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45">
                    <span>{REGION_LABELS[source.region]}</span>
                    {source.totalArticlesIngested != null && source.totalArticlesIngested > 0 && (
                      <span>{source.totalArticlesIngested} articles</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {source.slug && (
                      <Link
                        href={`/sources/${source.slug}`}
                        className="text-xs text-white/70 hover:text-white transition-colors"
                        aria-label={`View ${source.name} profile`}
                      >
                        View profile →
                      </Link>
                    )}
                    {source.url && (
                      <a
                        href={`https://${source.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-white/50 hover:text-white/70 transition-colors"
                      >
                        {source.url} ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
