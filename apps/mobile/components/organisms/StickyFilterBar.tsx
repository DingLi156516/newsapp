/**
 * StickyFilterBar — Horizontal strip of dismissible active-filter chips.
 * Returns null when no filters are active.
 */

import { Text, ScrollView, Pressable } from 'react-native'
import { X } from 'lucide-react-native'
import type {
  BiasCategory,
  DatePreset,
  FactualityLevel,
  Region,
  Topic,
} from '@/lib/shared/types'
import {
  ALL_BIASES,
  TOPIC_LABELS,
  REGION_LABELS,
  FACTUALITY_LABELS,
  DATE_PRESET_LABELS,
} from '@/lib/shared/types'
import { GlassView } from '@/components/ui/GlassView'
import { useTheme } from '@/lib/shared/theme'

interface Props {
  readonly topic: Topic | null
  readonly onClearTopic: () => void
  readonly region: Region | null
  readonly onClearRegion: () => void
  readonly biasRange: BiasCategory[]
  readonly onClearBiasRange: () => void
  readonly minFactuality: FactualityLevel | null
  readonly onClearMinFactuality: () => void
  readonly datePreset: DatePreset
  readonly onClearDatePreset: () => void
}

interface ChipData {
  readonly label: string
  readonly onDismiss: () => void
}

export function StickyFilterBar({
  topic,
  onClearTopic,
  region,
  onClearRegion,
  biasRange,
  onClearBiasRange,
  minFactuality,
  onClearMinFactuality,
  datePreset,
  onClearDatePreset,
}: Props) {
  const chips: ChipData[] = []

  if (topic !== null) {
    chips.push({ label: TOPIC_LABELS[topic], onDismiss: onClearTopic })
  }
  if (region !== null) {
    chips.push({ label: REGION_LABELS[region], onDismiss: onClearRegion })
  }
  if (biasRange.length < ALL_BIASES.length) {
    chips.push({ label: 'Bias filtered', onDismiss: onClearBiasRange })
  }
  if (minFactuality !== null) {
    chips.push({ label: FACTUALITY_LABELS[minFactuality], onDismiss: onClearMinFactuality })
  }
  if (datePreset !== 'all') {
    chips.push({ label: DATE_PRESET_LABELS[datePreset], onDismiss: onClearDatePreset })
  }

  if (chips.length === 0) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
    >
      {chips.map((chip) => (
        <FilterChip key={chip.label} label={chip.label} onDismiss={chip.onDismiss} />
      ))}
    </ScrollView>
  )
}

function FilterChip({ label, onDismiss }: {
  readonly label: string
  readonly onDismiss: () => void
}) {
  const theme = useTheme()
  return (
    <GlassView
      variant="sm"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 9999,
      }}
    >
      <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.text.secondary }}>
        {label}
      </Text>
      <Pressable onPress={onDismiss} hitSlop={8} testID="filter-chip-dismiss">
        <X size={12} color={theme.text.tertiary} />
      </Pressable>
    </GlassView>
  )
}
