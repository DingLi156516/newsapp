/**
 * SearchFilters — Bottom sheet with advanced filter controls.
 * Mobile adaptation of web's SearchFilters using @gorhom/bottom-sheet.
 */

import { useCallback, useMemo } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { X } from 'lucide-react-native'
import type {
  BiasCategory,
  DatePreset,
  FactualityLevel,
  PerspectiveFilter,
  Region,
  Topic,
} from '@/lib/shared/types'
import {
  ALL_BIASES,
  ALL_REGIONS,
  BIAS_LABELS,
  FACTUALITY_LABELS,
  DATE_PRESET_LABELS,
  REGION_LABELS,
  PERSPECTIVE_BIASES,
} from '@/lib/shared/types'
import { GlassView } from '@/components/ui/GlassView'

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

interface Props {
  readonly topic: Topic | null
  readonly onTopicChange: (v: Topic | null) => void
  readonly region: Region | null
  readonly onRegionChange: (v: Region | null) => void
  readonly biasRange: BiasCategory[]
  readonly onBiasRangeChange: (v: BiasCategory[]) => void
  readonly minFactuality: FactualityLevel | null
  readonly onMinFactualityChange: (v: FactualityLevel | null) => void
  readonly datePreset: DatePreset
  readonly onDatePresetChange: (v: DatePreset) => void
  readonly onClose: () => void
}

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

export function countActiveFilters(
  topic: Topic | null,
  region: Region | null,
  biasRange: BiasCategory[],
  minFactuality: FactualityLevel | null,
  datePreset: DatePreset
): number {
  let count = 0
  if (topic !== null) count += 1
  if (region !== null) count += 1
  if (biasRange.length < 7) count += 1
  if (minFactuality !== null) count += 1
  if (datePreset !== 'all') count += 1
  return count
}

export function SearchFilters({
  topic,
  onTopicChange,
  region,
  onRegionChange,
  biasRange,
  onBiasRangeChange,
  minFactuality,
  onMinFactualityChange,
  datePreset,
  onDatePresetChange,
  onClose,
}: Props) {
  const activeCount = countActiveFilters(topic, region, biasRange, minFactuality, datePreset)
  const activePreset = useMemo(() => deriveActivePreset(biasRange), [biasRange])

  const handlePreset = useCallback((preset: PerspectiveFilter) => {
    onBiasRangeChange([...PERSPECTIVE_BIASES[preset]])
  }, [onBiasRangeChange])

  const toggleBias = useCallback((bias: BiasCategory) => {
    const isSelected = biasRange.includes(bias)
    if (isSelected) {
      const next = biasRange.filter(b => b !== bias)
      onBiasRangeChange(next.length > 0 ? next : [bias])
    } else {
      onBiasRangeChange([...biasRange, bias])
    }
  }, [biasRange, onBiasRangeChange])

  const handleClear = useCallback(() => {
    onTopicChange(null)
    onRegionChange(null)
    onBiasRangeChange(ALL_BIASES)
    onMinFactualityChange(null)
    onDatePresetChange('all')
  }, [onTopicChange, onRegionChange, onBiasRangeChange, onMinFactualityChange, onDatePresetChange])

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0A0A0A' }}
      contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 18, color: 'white' }}>
          Filters
        </Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <X size={20} color="rgba(255, 255, 255, 0.5)" />
        </Pressable>
      </View>

      {/* Region */}
      <FilterSection label="REGION">
        <Pill
          label="All"
          isActive={region === null}
          onPress={() => onRegionChange(null)}
        />
        {ALL_REGIONS.map((r) => (
          <Pill
            key={r}
            label={REGION_LABELS[r]}
            isActive={region === r}
            onPress={() => onRegionChange(r)}
          />
        ))}
      </FilterSection>

      {/* Perspective */}
      <FilterSection label="PERSPECTIVE">
        {PRESET_OPTIONS.map((option) => (
          <Pill
            key={option.value}
            label={option.label}
            isActive={activePreset === option.value}
            onPress={() => handlePreset(option.value)}
          />
        ))}
      </FilterSection>

      {/* Bias Range */}
      <FilterSection label="BIAS RANGE">
        {ALL_BIASES.map((bias) => (
          <Pill
            key={bias}
            label={BIAS_LABELS[bias]}
            isActive={biasRange.includes(bias)}
            onPress={() => toggleBias(bias)}
          />
        ))}
      </FilterSection>

      {/* Min Factuality */}
      <FilterSection label="MIN FACTUALITY">
        {ALL_FACTUALITIES.map((level) => (
          <Pill
            key={level}
            label={FACTUALITY_LABELS[level]}
            isActive={minFactuality === level}
            onPress={() => onMinFactualityChange(minFactuality === level ? null : level)}
          />
        ))}
      </FilterSection>

      {/* Date Range */}
      <FilterSection label="DATE RANGE">
        {ALL_DATE_PRESETS.map((preset) => (
          <Pill
            key={preset}
            label={DATE_PRESET_LABELS[preset]}
            isActive={datePreset === preset}
            onPress={() => onDatePresetChange(preset)}
          />
        ))}
      </FilterSection>

      {/* Clear */}
      {activeCount > 0 && (
        <Pressable
          onPress={handleClear}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <X size={12} color="rgba(255, 255, 255, 0.5)" />
          <Text style={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
            Clear filters
          </Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterSection({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{
        fontFamily: 'Inter-Medium',
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.4)',
        letterSpacing: 1,
      }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {children}
      </View>
    </View>
  )
}

function Pill({ label, isActive, onPress }: {
  readonly label: string
  readonly isActive: boolean
  readonly onPress: () => void
}) {
  return (
    <Pressable onPress={onPress}>
      <GlassView
        variant="sm"
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 9999,
          backgroundColor: isActive ? 'rgba(255, 255, 255, 0.15)' : undefined,
          borderWidth: isActive ? 1 : 0,
          borderColor: isActive ? 'rgba(255, 255, 255, 0.2)' : undefined,
        }}
      >
        <Text style={{
          fontFamily: 'Inter',
          fontSize: 12,
          color: isActive ? 'white' : 'rgba(255, 255, 255, 0.4)',
        }}>
          {label}
        </Text>
      </GlassView>
    </Pressable>
  )
}
