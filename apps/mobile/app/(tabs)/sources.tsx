/**
 * Sources screen — Directory of news outlets with bottom-sheet filters,
 * sort controls, and rich source cards with spectrum-colored accents.
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import { View, FlatList, Pressable, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
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
import { SlidersHorizontal, X } from 'lucide-react-native'
import { NetworkErrorView } from '@/components/molecules/NetworkErrorView'
import { EmptyStateView } from '@/components/molecules/EmptyStateView'
import { useTheme } from '@/lib/shared/theme'
import {
  Text,
  Heading,
  Pill,
  Button,
  IconButton,
  Surface,
  ScreenHeader,
  Section,
  SegmentedControl,
  INK_TINT,
  RADIUS,
  SPACING,
  TOUCH_TARGET,
} from '@/lib/ui'

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
  const router = useRouter()
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
    bottomSheetRef.current?.snapToIndex(0)
  }, [])

  const closeFilters = useCallback(() => {
    bottomSheetRef.current?.close()
  }, [])

  const clearAllFilters = useCallback(() => {
    setBiasFilter(null)
    setFactualityFilter(null)
    setOwnershipFilter(null)
    setRegionFilter(null)
  }, [])

  const barehost = useCallback((url: string) => {
    const stripped = url.replace(/^https?:\/\//, '').replace(/^www\./, '')
    const slashIndex = stripped.indexOf('/')
    return slashIndex >= 0 ? stripped.slice(0, slashIndex) : stripped
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
        onPress={() => {
          if (item.slug) router.push(`/source/${item.slug}`)
        }}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Surface
          variant="glassSm"
          elevation="sm"
          accent={color}
          style={{
            padding: SPACING.md + 2,
            marginHorizontal: SPACING.lg,
            marginVertical: SPACING.xs,
          }}
        >
          <View style={{ flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' }}>
            <SourceLogo domain={item.url} name={item.name} bias={item.bias} size={48} />
            <View style={{ flex: 1, gap: SPACING.xs }}>
              <Text variant="heading">{item.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' }}>
                <View
                  style={{
                    backgroundColor: `${color}33`,
                    paddingHorizontal: SPACING.sm,
                    paddingVertical: 2,
                    borderRadius: RADIUS.pill,
                  }}
                >
                  <Text variant="badge" style={{ color }}>
                    {BIAS_LABELS[item.bias]}
                  </Text>
                </View>
                <FactualityBar level={item.factuality} size="compact" showLabel />
              </View>
              {item.url && (
                <Text variant="small" tone="muted">
                  {barehost(item.url)}
                </Text>
              )}
            </View>
          </View>
        </Surface>
      </Pressable>
    )
  }, [router, barehost])

  type ListRow =
    | { readonly kind: 'header'; readonly label: string }
    | { readonly kind: 'source'; readonly source: NewsSource }

  const listData = useMemo<readonly ListRow[]>(() => {
    if (sortMode === 'name') {
      return sorted.map((source) => ({ kind: 'source' as const, source }))
    }
    const rows: ListRow[] = []
    let lastGroup: string | null = null
    for (const source of sorted) {
      const group = sortMode === 'bias' ? BIAS_LABELS[source.bias] : FACTUALITY_LABELS[source.factuality]
      if (group !== lastGroup) {
        rows.push({ kind: 'header', label: group })
        lastGroup = group
      }
      rows.push({ kind: 'source', source })
    }
    return rows
  }, [sortMode, sorted])

  const renderRow = useCallback(
    ({ item }: { item: ListRow }) => {
      if (item.kind === 'header') {
        return (
          <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xs }}>
            <Text variant="overline" tone="muted">
              {item.label}
            </Text>
          </View>
        )
      }
      return renderSource({ item: item.source })
    },
    [renderSource],
  )

  const SkeletonCards = useMemo(() => (
    <View style={{ paddingHorizontal: SPACING.lg, gap: SPACING.sm }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Surface
          key={i}
          variant="glassSm"
          elevation="sm"
          style={{ padding: SPACING.md + 2, flexDirection: 'row', gap: SPACING.md }}
        >
          <View style={{ width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: theme.semantic.muted.bg }} />
          <View style={{ flex: 1, gap: SPACING.xs + 2 }}>
            <View style={{ height: 12, borderRadius: 6, backgroundColor: theme.semantic.muted.bg, width: '60%' }} />
            <View style={{ height: 10, borderRadius: 5, backgroundColor: `rgba(${theme.inkRgb}, ${INK_TINT.whisper})`, width: '40%' }} />
            <View style={{ height: 10, borderRadius: 5, backgroundColor: `rgba(${theme.inkRgb}, ${INK_TINT.whisper})`, width: '70%' }} />
          </View>
        </Surface>
      ))}
    </View>
  ), [theme])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.background }} edges={['top']}>
      {/* Sticky header */}
      <View style={{ paddingTop: SPACING.sm, paddingBottom: SPACING.sm, gap: SPACING.sm + 2 }}>
        <ScreenHeader
          title="Sources"
          trailing={[
            <IconButton
              key="filters"
              icon={SlidersHorizontal}
              onPress={openFilters}
              accessibilityLabel={`Filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
              badge={activeFilterCount > 0 ? activeFilterCount : undefined}
            />,
          ]}
        />

        <View style={{ paddingHorizontal: SPACING.lg }}>
          <SearchBar
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
            placeholder="Search sources..."
          />
        </View>

        <View style={{ paddingHorizontal: SPACING.lg }}>
          <SegmentedControl
            testID="sort"
            value={sortMode}
            onChange={setSortMode}
            options={[
              { value: 'name', label: 'A-Z' },
              { value: 'bias', label: 'Bias' },
              { value: 'factuality', label: 'Factuality' },
            ]}
          />
        </View>

        {/* Active filter chips + source count */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2, flexWrap: 'wrap', paddingHorizontal: SPACING.lg }}>
          <Text variant="caption" tone="tertiary">
            {sorted.length} source{sorted.length !== 1 ? 's' : ''}
          </Text>
          {biasFilter && (
            <Pill label={BIAS_LABELS[biasFilter]} dismissible onPress={() => setBiasFilter(null)} />
          )}
          {factualityFilter && (
            <Pill label={FACTUALITY_LABELS[factualityFilter]} dismissible onPress={() => setFactualityFilter(null)} />
          )}
          {ownershipFilter && (
            <Pill label={OWNERSHIP_LABELS[ownershipFilter]} dismissible onPress={() => setOwnershipFilter(null)} />
          )}
          {regionFilter && (
            <Pill label={REGION_LABELS[regionFilter]} dismissible onPress={() => setRegionFilter(null)} />
          )}
        </View>
      </View>

      {/* Source list */}
      <FlatList
        data={listData}
        renderItem={renderRow}
        keyExtractor={(item) =>
          item.kind === 'header' ? `h:${item.label}` : item.source.id
        }
        ListEmptyComponent={
          isError
            ? <NetworkErrorView onRetry={() => mutate()} />
            : isLoading
              ? SkeletonCards
              : <EmptyStateView icon="search" title="No Matches" message="No sources match your current filters." actionLabel="Clear Filters" onAction={() => { clearAllFilters(); setSearch('') }} />
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
        <BottomSheetScrollView contentContainerStyle={{ padding: SPACING.xl, gap: SPACING.lg + 4, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACING.md }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Heading variant="title">Filters</Heading>
              <Text variant="caption" tone="tertiary">
                Narrow down by bias, factuality, ownership, region.
              </Text>
            </View>
            <Pressable onPress={closeFilters} hitSlop={TOUCH_TARGET.hitSlop} accessibilityLabel="Close filters">
              <X size={20} color={theme.text.tertiary} />
            </Pressable>
          </View>

          <Section label="BIAS">
            <FilterPillRow
              items={ALL_BIASES}
              labels={BIAS_LABELS}
              selected={biasFilter}
              onSelect={(v) => setBiasFilter(biasFilter === v ? null : v)}
              onSelectAll={() => setBiasFilter(null)}
            />
          </Section>
          <Section label="FACTUALITY">
            <FilterPillRow
              items={ALL_FACTUALITIES}
              labels={FACTUALITY_LABELS}
              selected={factualityFilter}
              onSelect={(v) => setFactualityFilter(factualityFilter === v ? null : v)}
              onSelectAll={() => setFactualityFilter(null)}
            />
          </Section>
          <Section label="OWNERSHIP">
            <FilterPillRow
              items={ALL_OWNERSHIPS}
              labels={OWNERSHIP_LABELS}
              selected={ownershipFilter}
              onSelect={(v) => setOwnershipFilter(ownershipFilter === v ? null : v)}
              onSelectAll={() => setOwnershipFilter(null)}
            />
          </Section>
          <Section label="REGION">
            <FilterPillRow
              items={ALL_REGIONS}
              labels={REGION_LABELS}
              selected={regionFilter}
              onSelect={(v) => setRegionFilter(regionFilter === v ? null : v)}
              onSelectAll={() => setRegionFilter(null)}
            />
          </Section>

          <View style={{ flexDirection: 'row', gap: SPACING.md }}>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" fullWidth onPress={clearAllFilters}>
                Clear All
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button variant="primary" fullWidth onPress={closeFilters}>
                Done
              </Button>
            </View>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterPillRow<T extends string>({
  items, labels, selected, onSelect, onSelectAll,
}: {
  readonly items: readonly T[]
  readonly labels: Record<T, string>
  readonly selected: T | null
  readonly onSelect: (v: T) => void
  readonly onSelectAll: () => void
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.xs + 2 }}>
      <Pill label="All" active={selected === null} onPress={onSelectAll} />
      {items.map((item) => (
        <Pill key={item} label={labels[item]} active={selected === item} onPress={() => onSelect(item)} />
      ))}
    </ScrollView>
  )
}
