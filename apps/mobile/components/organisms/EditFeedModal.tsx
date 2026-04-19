/**
 * EditFeedModal — Bottom sheet for customizing visible feed tabs and sort order.
 * Now includes a TRENDING TOPICS section for hiding/showing promoted tags.
 * Converted from Modal to @gorhom/bottom-sheet for native-feeling interaction.
 */

import { useCallback, useRef, useEffect, useState, type ReactNode } from 'react'
import { View, Text, Pressable, Switch } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronDown } from 'lucide-react-native'
import type { FeedSort, UnifiedTab, StoryTag } from '@/lib/shared/types'
import type { FeedConfig } from '@/lib/hooks/use-feed-config'
import {
  IN_FEED_TABS, ALL_TOPICS, FEED_TAB_LABELS, TOPIC_LABELS,
  FEED_SORT_LABELS, TAG_TYPE_COLORS,
} from '@/lib/shared/types'
import { GlassView } from '@/components/ui/GlassView'
import { useTheme } from '@/lib/shared/theme'
import { hapticLight } from '@/lib/haptics'

const TAB_BAR_HEIGHT = 49

interface CollapsibleSectionProps {
  readonly label: string
  readonly accessory?: ReactNode
  readonly children: ReactNode
}

function CollapsibleSection({ label, accessory, children }: CollapsibleSectionProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)
  const rotation = useSharedValue(0)
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    rotation.value = withTiming(next ? 180 : 0, { duration: 180 })
    hapticLight()
  }

  const sectionLabel = {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: theme.text.tertiary,
    letterSpacing: 1,
  } as const

  return (
    <GlassView style={{ padding: 16, gap: expanded ? 12 : 0 }}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${label} section, ${expanded ? 'expanded' : 'collapsed'}`}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flex: 1 }}>
          <Text style={sectionLabel}>{label}</Text>
          {accessory}
        </View>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={18} color={theme.text.tertiary} />
        </Animated.View>
      </Pressable>
      {expanded && <View style={{ gap: 12 }}>{children}</View>}
    </GlassView>
  )
}

interface Props {
  readonly visible: boolean
  readonly onClose: () => void
  readonly visibleFeeds: readonly UnifiedTab[]
  readonly feedSort: FeedSort
  readonly hiddenPromotedTags: readonly string[]
  readonly promotedTags?: readonly StoryTag[]
  readonly onUpdateConfig: (updates: Partial<FeedConfig>) => void
}

const SORT_OPTIONS: FeedSort[] = ['most-covered', 'most-recent']
const SHEET_SNAP_POINTS = ['75%', '95%']

export function EditFeedModal({ visible, onClose, visibleFeeds, feedSort, hiddenPromotedTags, promotedTags, onUpdateConfig }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const bottomSheetRef = useRef<BottomSheet>(null)
  // Legacy configs may persist `blindspot` (now a bottom-nav tab, not in the
  // in-feed bar). Sanitize it out before computing counts so the last-tab
  // guard reflects only tabs the modal actually renders.
  const ALLOWED_FEEDS = new Set<string>([...IN_FEED_TABS, ...ALL_TOPICS])
  const sanitizedFeeds = visibleFeeds.filter((t) => ALLOWED_FEEDS.has(t))
  const visibleSet = new Set<string>(sanitizedFeeds)
  const enabledCount = visibleSet.size
  const hiddenSet = new Set<string>(hiddenPromotedTags)

  const tagKey = (slug: string, type: string) => `${slug}:${type}`

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.snapToIndex(0)
    } else {
      bottomSheetRef.current?.close()
    }
  }, [visible])

  const toggleFeed = (tab: UnifiedTab) => {
    const isEnabled = visibleSet.has(tab)
    if (isEnabled && enabledCount <= 1) return

    const updated = isEnabled
      ? sanitizedFeeds.filter((t) => t !== tab)
      : [...sanitizedFeeds, tab]
    onUpdateConfig({ visibleFeeds: updated })
  }

  const togglePromotedTag = (slug: string, type: string) => {
    const key = tagKey(slug, type)
    const isHidden = hiddenSet.has(key)
    const updated = isHidden
      ? hiddenPromotedTags.filter((s) => s !== key)
      : [...hiddenPromotedTags, key]
    onUpdateConfig({ hiddenPromotedTags: updated })
  }

  const setSortOrder = (sort: FeedSort) => {
    onUpdateConfig({ feedSort: sort })
  }

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} opacity={0.4} pressBehavior="close" disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    []
  )

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) onClose()
  }, [onClose])

  const trackOff = `rgba(${theme.inkRgb}, 0.1)`
  const trackOn = `rgba(${theme.inkRgb}, 0.3)`

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={SHEET_SNAP_POINTS}
      enableDynamicSizing={false}
      enablePanDownToClose
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.surface.background }}
      handleIndicatorStyle={{ backgroundColor: theme.surface.borderPill, width: 36 }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: 'DMSerifDisplay', fontSize: 24, color: theme.text.primary }}>
            Edit Feed
          </Text>
          <Pressable testID="edit-feed-done" onPress={onClose} hitSlop={8}>
            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 15, color: theme.text.primary }}>
              Done
            </Text>
          </Pressable>
        </View>

        {/* Feeds section */}
        <CollapsibleSection label="FEEDS">
          {IN_FEED_TABS.map((tab) => {
            const isEnabled = visibleSet.has(tab)
            return (
              <View key={tab} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'Inter', fontSize: 15, color: theme.text.primary }}>
                  {FEED_TAB_LABELS[tab]}
                </Text>
                <Switch
                  testID={`edit-feed-toggle-${tab}`}
                  value={isEnabled}
                  onValueChange={() => toggleFeed(tab)}
                  disabled={isEnabled && enabledCount <= 1}
                  trackColor={{ false: trackOff, true: trackOn }}
                  thumbColor={theme.text.primary}
                />
              </View>
            )
          })}
        </CollapsibleSection>

        {/* Topics section */}
        <CollapsibleSection label="TOPICS">
          {ALL_TOPICS.map((topic) => {
            const isEnabled = visibleSet.has(topic)
            return (
              <View key={topic} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'Inter', fontSize: 15, color: theme.text.primary }}>
                  {TOPIC_LABELS[topic]}
                </Text>
                <Switch
                  testID={`edit-feed-toggle-${topic}`}
                  value={isEnabled}
                  onValueChange={() => toggleFeed(topic)}
                  disabled={isEnabled && enabledCount <= 1}
                  trackColor={{ false: trackOff, true: trackOn }}
                  thumbColor={theme.text.primary}
                />
              </View>
            )
          })}
        </CollapsibleSection>

        {/* Trending topics section */}
        {promotedTags && promotedTags.length > 0 && (
          <CollapsibleSection
            label="TRENDING TOPICS"
            accessory={
              <Text style={{ fontFamily: 'Inter', fontSize: 11, color: theme.text.muted }}>
                auto-detected
              </Text>
            }
          >
            {promotedTags.map((tag) => {
              const isEnabled = !hiddenSet.has(tagKey(tag.slug, tag.type))
              const dotColor = TAG_TYPE_COLORS[tag.type]
              return (
                <View key={`${tag.slug}:${tag.type}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
                    <Text style={{ fontFamily: 'Inter', fontSize: 15, color: theme.text.primary }}>
                      {tag.label}
                    </Text>
                    <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.text.muted }}>
                      ({tag.storyCount})
                    </Text>
                  </View>
                  <Switch
                    testID={`edit-feed-toggle-ptag-${tag.slug}`}
                    value={isEnabled}
                    onValueChange={() => togglePromotedTag(tag.slug, tag.type)}
                    trackColor={{ false: trackOff, true: trackOn }}
                    thumbColor={theme.text.primary}
                  />
                </View>
              )
            })}
          </CollapsibleSection>
        )}

        {/* Sort section */}
        <CollapsibleSection label="SORT ORDER">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SORT_OPTIONS.map((sort) => {
              const isActive = feedSort === sort
              return (
                <Pressable key={sort} testID={`edit-feed-sort-${sort}`} onPress={() => setSortOrder(sort)}>
                  <View style={{
                    backgroundColor: isActive ? `rgba(${theme.inkRgb}, 0.1)` : 'transparent',
                    borderWidth: 0.5,
                    borderColor: isActive ? theme.surface.borderPill : theme.surface.border,
                    borderRadius: 9999,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                  }}>
                    <Text style={{
                      fontFamily: 'Inter',
                      fontSize: 13,
                      color: isActive ? theme.text.primary : theme.text.tertiary,
                    }}>
                      {FEED_SORT_LABELS[sort]}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        </CollapsibleSection>
      </BottomSheetScrollView>
    </BottomSheet>
  )
}
