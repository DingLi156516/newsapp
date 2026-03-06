'use client'

import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import type { BiasCategory, FactualityLevel, DatePreset, PerspectiveFilter, Topic } from '@/lib/types'
import {
  ALL_BIASES,
  BIAS_LABELS,
  BIAS_CSS_CLASS,
  FACTUALITY_LABELS,
  DATE_PRESET_LABELS,
  TOPIC_LABELS,
  PERSPECTIVE_BIASES,
} from '@/lib/types'

const ALL_TOPICS: Topic[] = [
  'politics', 'world', 'technology', 'business', 'science',
  'health', 'culture', 'sports', 'environment',
]

const ALL_FACTUALITIES: FactualityLevel[] = [
  'very-low', 'low', 'mixed', 'high', 'very-high',
]

const ALL_DATE_PRESETS: DatePreset[] = ['24h', '7d', '30d', 'all']

const PRESET_OPTIONS: { value: PerspectiveFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

function deriveActivePreset(biasRange: BiasCategory[]): PerspectiveFilter | null {
  for (const option of PRESET_OPTIONS) {
    const expected = PERSPECTIVE_BIASES[option.value]
    if (
      biasRange.length === expected.length &&
      expected.every(b => biasRange.includes(b))
    ) {
      return option.value
    }
  }
  return null
}

interface Props {
  readonly topic: Topic | null
  readonly onTopicChange: (v: Topic | null) => void
  readonly biasRange: BiasCategory[]
  readonly onBiasRangeChange: (v: BiasCategory[]) => void
  readonly minFactuality: FactualityLevel | null
  readonly onMinFactualityChange: (v: FactualityLevel | null) => void
  readonly datePreset: DatePreset
  readonly onDatePresetChange: (v: DatePreset) => void
}

function countActiveFilters(
  topic: Topic | null,
  biasRange: BiasCategory[],
  minFactuality: FactualityLevel | null,
  datePreset: DatePreset
): number {
  let count = 0
  if (topic !== null) count += 1
  if (biasRange.length < 7) count += 1
  if (minFactuality !== null) count += 1
  if (datePreset !== 'all') count += 1
  return count
}

export function SearchFilters({
  topic,
  onTopicChange,
  biasRange,
  onBiasRangeChange,
  minFactuality,
  onMinFactualityChange,
  datePreset,
  onDatePresetChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const activeCount = countActiveFilters(topic, biasRange, minFactuality, datePreset)
  const activePreset = deriveActivePreset(biasRange)

  function handlePreset(preset: PerspectiveFilter) {
    onBiasRangeChange([...PERSPECTIVE_BIASES[preset]])
  }

  function toggleBias(bias: BiasCategory) {
    const isSelected = biasRange.includes(bias)
    if (isSelected) {
      const next = biasRange.filter(b => b !== bias)
      onBiasRangeChange(next.length > 0 ? next : [bias])
    } else {
      onBiasRangeChange([...biasRange, bias])
    }
  }

  function handleClear() {
    onTopicChange(null)
    onBiasRangeChange(ALL_BIASES)
    onMinFactualityChange(null)
    onDatePresetChange('all')
  }

  return (
    <div className="space-y-2">
      <button
        data-testid="search-filters-toggle"
        onClick={() => setOpen(prev => !prev)}
        className="glass-pill flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/70 hover:text-white transition-colors"
        aria-expanded={open}
      >
        <SlidersHorizontal size={13} />
        <span>Filters</span>
        {activeCount > 0 && (
          <span
            data-testid="filter-count-badge"
            className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-medium text-white"
          >
            {activeCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            data-testid="search-filters-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-sm rounded-xl p-4 space-y-4">
              {/* Topic */}
              <div className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Topic
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    data-testid="topic-filter-pill-all"
                    aria-pressed={topic === null}
                    onClick={() => onTopicChange(null)}
                    className={`glass-pill px-2.5 py-1 text-xs transition-all ${
                      topic === null
                        ? 'bg-white/15 text-white ring-1 ring-white/20'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    All
                  </button>
                  {ALL_TOPICS.map((t) => {
                    const isActive = topic === t
                    return (
                      <button
                        key={t}
                        data-testid={`topic-filter-pill-${t}`}
                        aria-pressed={isActive}
                        onClick={() => onTopicChange(t)}
                        className={`glass-pill px-2.5 py-1 text-xs transition-all ${
                          isActive
                            ? 'bg-white/15 text-white ring-1 ring-white/20'
                            : 'text-white/40 hover:text-white/60'
                        }`}
                      >
                        {TOPIC_LABELS[t]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Perspective Presets */}
              <div className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Perspective
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_OPTIONS.map((option) => {
                    const isActive = activePreset === option.value
                    return (
                      <button
                        key={option.value}
                        data-testid={`perspective-preset-${option.value}`}
                        aria-pressed={isActive}
                        onClick={() => handlePreset(option.value)}
                        className={`glass-pill px-2.5 py-1 text-xs transition-all ${
                          isActive
                            ? 'bg-white/15 text-white ring-1 ring-white/20'
                            : 'text-white/40 hover:text-white/60'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Bias Range */}
              <div className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Bias Range
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_BIASES.map((bias) => {
                    const isActive = biasRange.includes(bias)
                    return (
                      <button
                        key={bias}
                        data-testid={`bias-pill-${bias}`}
                        aria-pressed={isActive}
                        onClick={() => toggleBias(bias)}
                        className={`glass-pill px-2.5 py-1 text-xs transition-all ${
                          isActive
                            ? `${BIAS_CSS_CLASS[bias]} text-white ring-1 ring-white/20`
                            : 'text-white/40 hover:text-white/60'
                        }`}
                      >
                        {BIAS_LABELS[bias]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Min Factuality */}
              <div className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Min Factuality
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_FACTUALITIES.map((level) => {
                    const isActive = minFactuality === level
                    return (
                      <button
                        key={level}
                        data-testid={`factuality-pill-${level}`}
                        aria-pressed={isActive}
                        onClick={() => onMinFactualityChange(isActive ? null : level)}
                        className={`glass-pill px-2.5 py-1 text-xs transition-all ${
                          isActive
                            ? 'bg-white/15 text-white ring-1 ring-white/20'
                            : 'text-white/40 hover:text-white/60'
                        }`}
                      >
                        {FACTUALITY_LABELS[level]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Date Range
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_DATE_PRESETS.map((preset) => {
                    const isActive = datePreset === preset
                    return (
                      <button
                        key={preset}
                        data-testid={`date-preset-${preset}`}
                        aria-pressed={isActive}
                        onClick={() => onDatePresetChange(preset)}
                        className={`glass-pill px-2.5 py-1 text-xs transition-all ${
                          isActive
                            ? 'bg-white/15 text-white ring-1 ring-white/20'
                            : 'text-white/40 hover:text-white/60'
                        }`}
                      >
                        {DATE_PRESET_LABELS[preset]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Clear */}
              {activeCount > 0 && (
                <button
                  data-testid="clear-filters"
                  onClick={handleClear}
                  className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 transition-colors"
                >
                  <X size={12} />
                  <span>Clear filters</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
