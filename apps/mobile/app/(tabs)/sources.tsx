/**
 * Sources screen — Directory of news outlets with bottom-sheet filters,
 * sort controls, and rich source cards with spectrum-colored accents.
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import { View, Text, FlatList, Pressable, Linking, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useSources } from '@/lib/hooks/use-sources'
import { useDebounce } from '@/lib/hooks/use-debounce'
import type { NewsSource, BiasCategory, FactualityLevel, OwnershipType, Region } from '@/lib/shared/types'
import {
  ALL_BIASES,
  ALL_FACTUALITIES,
  ALL_OWNERSHIPS,
  ALL_REGIONS,
  BIAS_LABELS,
  BIAS_COLOR,
  FACTUALITY_LABELS,
  OWNERSHIP_LABELS,
  REGION_LABELS,
} from '@/lib/shared/types'
import { SearchBar } from '@/components/organisms/SearchBar'
import { SourceLogo } from '@/components/atoms/SourceLogo'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { GlassView } from '@/components/ui/GlassView'
import { SlidersHorizontal, X } from 'lucide-react-native'
import { NetworkErrorView } from '@/components/molecules/NetworkErrorView'
import { EmptyStateView } from '@/components/molecules/EmptyStateView'
import { hapticLight } from '@/lib/haptics'
import { TOUCH_TARGET } from '@/lib/shared/design'
import { useTheme } from '@/lib/shared/theme'

type SortMode = 'name' | 'bias' | 'factuality'

const BIAS_ORDER: Record<BiasCategory, number> = {
  'far-left': 0, 'left': 1, 'lean-left': 2, 'center': 3, 'lean-right': 4, 'right': 5, 'far-right': 6,
}

const FACTUALITY_ORDER: Record<FactualityLevel, number> = {
  'very-high': 0, 'high': 1, 'mixed': 2, 'low': 3, 'very-low': 4,
}

const SHEET_SNAP_POINTS = ['70%', '95%']

export default function SourcesScreen() {
  const theme = useTheme()
  const [search, setSearch] = useState('')
  const [biasFilter, setBiasFilter] = useState<BiasCategory | null>(null)
  const [factualityFilter, setFactualityFilter] = useState<FactualityLevel | null>(null)
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipType | null>(null)
  const [regionFilter, setRegionFilter] = useState<Region | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('name')
  const debouncedSearch = useDebounce(search, 300)
  const bottomSheetRef = useRef<BottomSheet>(null)

  const { sources, isLoading, isError, mutate } = useSources({
    search: debouncedSearch,
    bias: biasFilter,
    factuality: factualityFilter,
    ownership: ownershipFilter,
    region: regionFilter,
  })

  const activeFilterCount = [biasFilter, factualityFilter, ownershipFilter, regionFilter].filter(Boolean).length

  const sorted = useMemo(() => {
    const list = [...sources]
    switch (sortMode) {
      case 'bias':
        return list.sort((a, b) => BIAS_ORDER[a.bias] - BIAS_ORDER[b.bias])
      case 'factuality':
        return list.sort((a, b) => FACTUALITY_ORDER[a.factuality] - FACTUALITY_ORDER[b.factuality])
      default:
        return list.sort((a, b) => a.name.localeCompare(b.name))
    }
  }, [sources, sortMode])

  const openFilters = useCallback(() => {
    hapticLight()
    bottomSheetRef.current?.snapToIndex(0)
  }, [])

  const closeFilters = useCallback(() => {
    bottomSheetRef.current?.close()
  }, [])

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} opacity={0.4} pressBehavior="close" disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    []
  )

  const renderSource = useCallback(({ item }: { item: NewsSource }) => {
    const color = BIAS_COLOR[item.bias]
    return (
      <Pressable
        testID="source-card"
        onPress={() => { if (item.url) Linking.openURL(`https://${item.url}`) }}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <GlassView variant="sm" style={{ padding: 14, marginHorizontal: 16, marginVertical: 4, borderLeftWidth: 3, borderLeftColor: color }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <SourceLogo domain={item.url} name={item.name} bias={item.bias} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 15, color: theme.text.primary, marginBottom: 3 }}>
                {item.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                <View style={{ backgroundColor: `${color}33`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}>
                  <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 10, color }}>{BIAS_LABELS[item.bias]}</Text>
                </View>
                <FactualityBar level={item.factuality} size="compact" showLabel />
              </View>
              <Text style={{ fontFamily: 'Inter', fontSize: 11, color: theme.text.muted }}>
                {item.url}
              </Text>
            </View>
          </View>
        </GlassView>
      </Pressable>
    )
  }, [theme])

  const SkeletonCards = useMemo(() => (
    <View style={{ paddingHorizontal: 16, gap: 8 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <GlassView key={i} variant="sm" style={{ padding: 14, flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: theme.semantic.muted.bg }} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ height: 12, borderRadius: 6, backgroundColor: theme.semantic.muted.bg, width: '60%' }} />
            <View style={{ height: 10, borderRadius: 5, backgroundColor: `rgba(${theme.inkRgb}, 0.03)`, width: '40%' }} />
            <View style={{ height: 10, borderRadius: 5, backgroundColor: `rgba(${theme.inkRgb}, 0.03)`, width: '70%' }} />
          </View>
        </GlassView>
      ))}
    </View>
  ), [theme])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.background }} edges={['top']}>
      {/* Sticky header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: 'DMSerifDisplay', fontSize: 24, color: theme.text.primary }}>Sources</Text>
          <Pressable
            onPress={openFilters}
            hitSlop={TOUCH_TARGET.hitSlop}
            accessibilityLabel={`Filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.surface.glassPill, borderWidth: 0.5, borderColor: theme.surface.borderPill, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
          >
            <SlidersHorizontal size={14} color={theme.text.secondary} />
            <Text style={{ fontFamily: 'Inter', fontSize: 13, color: theme.text.secondary }}>Filters</Text>
            {activeFilterCount > 0 && (
              <View style={{ backgroundColor: `rgba(${theme.inkRgb}, 0.15)`, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99 }}>
                <Text style={{ fontFamily: 'Inter-Bold', fontSize: 10, color: theme.text.primary }}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <SearchBar
          value={search}
          onChange={setSearch}
          onClear={() => setSearch('')}
          placeholder="Search sources..."
        />

        {/* Sort pills */}
        <View testID="sort-row" style={{ flexDirection: 'row', gap: 6 }}>
          {(['name', 'bias', 'factuality'] as const).map((mode) => {
            const isActive = sortMode === mode
            const label = mode === 'name' ? 'A-Z' : mode === 'bias' ? 'Bias' : 'Factuality'
            return (
              <Pressable
                key={mode}
                testID={`sort-${mode}`}
                onPress={() => { hapticLight(); setSortMode(mode) }}
              >
                <View style={{
                  backgroundColor: isActive ? `rgba(${theme.inkRgb}, 0.1)` : 'transparent',
                  borderWidth: 0.5,
                  borderColor: isActive ? theme.surface.borderPill : theme.surface.border,
                  borderRadius: 99,
                  paddingHorizontal: 14,
                  paddingVertical: 5,
                }}>
                  <Text style={{ fontFamily: 'Inter', fontSize: 12, color: isActive ? theme.text.primary : theme.text.tertiary }}>
                    {label}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>

        {/* Active filter chips + source count */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.text.tertiary }}>
            {sorted.length} source{sorted.length !== 1 ? 's' : ''}
          </Text>
          {biasFilter && (
            <ActiveChip label={BIAS_LABELS[biasFilter]} onDismiss={() => setBiasFilter(null)} />
          )}
          {factualityFilter && (
            <ActiveChip label={FACTUALITY_LABELS[factualityFilter]} onDismiss={() => setFactualityFilter(null)} />
          )}
          {ownershipFilter && (
            <ActiveChip label={OWNERSHIP_LABELS[ownershipFilter]} onDismiss={() => setOwnershipFilter(null)} />
          )}
          {regionFilter && (
            <ActiveChip label={REGION_LABELS[regionFilter]} onDismiss={() => setRegionFilter(null)} />
          )}
        </View>
      </View>

      {/* Source list */}
      <FlatList
        data={sorted}
        renderItem={renderSource}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          isError
            ? <NetworkErrorView onRetry={() => mutate()} />
            : isLoading
              ? SkeletonCards
              : <EmptyStateView icon="search" title="No Matches" message="No sources match your current filters." actionLabel="Clear Filters" onAction={() => { setBiasFilter(null); setFactualityFilter(null); setOwnershipFilter(null); setRegionFilter(null); setSearch('') }} />
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Filter bottom sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={SHEET_SNAP_POINTS}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: theme.surface.background }}
        handleIndicatorStyle={{ backgroundColor: theme.surface.borderPill, width: 36 }}
      >
        <BottomSheetScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontFamily: 'DMSerifDisplay', fontSize: 22, color: theme.text.primary }}>Filters</Text>
            <Pressable onPress={closeFilters} hitSlop={TOUCH_TARGET.hitSlop}>
              <X size={20} color={theme.text.tertiary} />
            </Pressable>
          </View>

          <FilterSection label="BIAS">
            <FilterPillRow items={ALL_BIASES} labels={BIAS_LABELS} selected={biasFilter} onSelect={(v) => setBiasFilter(biasFilter === v ? null : v)} onSelectAll={() => setBiasFilter(null)} allSelected={biasFilter === null} />
          </FilterSection>
          <FilterSection label="FACTUALITY">
            <FilterPillRow items={ALL_FACTUALITIES} labels={FACTUALITY_LABELS} selected={factualityFilter} onSelect={(v) => setFactualityFilter(factualityFilter === v ? null : v)} onSelectAll={() => setFactualityFilter(null)} allSelected={factualityFilter === null} />
          </FilterSection>
          <FilterSection label="OWNERSHIP">
            <FilterPillRow items={ALL_OWNERSHIPS} labels={OWNERSHIP_LABELS} selected={ownershipFilter} onSelect={(v) => setOwnershipFilter(ownershipFilter === v ? null : v)} onSelectAll={() => setOwnershipFilter(null)} allSelected={ownershipFilter === null} />
          </FilterSection>
          <FilterSection label="REGION">
            <FilterPillRow items={ALL_REGIONS} labels={REGION_LABELS} selected={regionFilter} onSelect={(v) => setRegionFilter(regionFilter === v ? null : v)} onSelectAll={() => setRegionFilter(null)} allSelected={regionFilter === null} />
          </FilterSection>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={() => { setBiasFilter(null); setFactualityFilter(null); setOwnershipFilter(null); setRegionFilter(null) }}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.semantic.muted.bg, alignItems: 'center' }}
            >
              <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 15, color: theme.text.secondary }}>Clear All</Text>
            </Pressable>
            <Pressable
              onPress={closeFilters}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.text.primary, alignItems: 'center' }}
            >
              <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 15, color: theme.surface.background }}>Done</Text>
            </Pressable>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActiveChip({ label, onDismiss }: { readonly label: string; readonly onDismiss: () => void }) {
  const theme = useTheme()
  return (
    <Pressable onPress={onDismiss} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.semantic.muted.bg, borderWidth: 0.5, borderColor: theme.surface.borderPill, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontFamily: 'Inter', fontSize: 10, color: theme.text.secondary }}>{label}</Text>
      <Text style={{ fontSize: 8, color: theme.text.tertiary }}>✕</Text>
    </Pressable>
  )
}

function FilterSection({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  const theme = useTheme()
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: 'Inter-Medium', fontSize: 10, color: theme.text.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </Text>
      {children}
    </View>
  )
}

function FilterPillRow<T extends string>({
  items, labels, selected, onSelect, onSelectAll, allSelected,
}: {
  readonly items: readonly T[]
  readonly labels: Record<T, string>
  readonly selected: T | null
  readonly onSelect: (v: T) => void
  readonly onSelectAll: () => void
  readonly allSelected: boolean
}) {
  const theme = useTheme()
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      <Pressable onPress={() => { hapticLight(); onSelectAll() }}>
        <View style={{
          backgroundColor: allSelected ? `rgba(${theme.inkRgb}, 0.1)` : 'transparent',
          borderWidth: 0.5,
          borderColor: allSelected ? theme.surface.borderPill : theme.surface.border,
          borderRadius: 9999,
          paddingHorizontal: 14,
          paddingVertical: 6,
        }}>
          <Text style={{ fontFamily: 'Inter', fontSize: 13, color: allSelected ? theme.text.primary : theme.text.tertiary }}>All</Text>
        </View>
      </Pressable>
      {items.map((item) => {
        const isActive = selected === item
        return (
          <Pressable key={item} onPress={() => { hapticLight(); onSelect(item) }}>
            <View style={{
              backgroundColor: isActive ? `rgba(${theme.inkRgb}, 0.1)` : 'transparent',
              borderWidth: 0.5,
              borderColor: isActive ? theme.surface.borderPill : theme.surface.border,
              borderRadius: 9999,
              paddingHorizontal: 14,
              paddingVertical: 6,
            }}>
              <Text style={{ fontFamily: 'Inter', fontSize: 13, color: isActive ? theme.text.primary : theme.text.tertiary }}>{labels[item]}</Text>
            </View>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
