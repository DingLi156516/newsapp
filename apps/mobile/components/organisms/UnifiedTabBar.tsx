/**
 * UnifiedTabBar — Horizontally scrollable tab bar for feeds, topics,
 * and promoted tags with animated sliding underline.
 */

import { useRef, useCallback, useEffect } from 'react'
import { ScrollView, View, Text, Pressable, type LayoutChangeEvent } from 'react-native'
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated'
import type { UnifiedTab, StoryTag, SelectedPromotedTag } from '@/lib/shared/types'
import { getUnifiedTabLabel, TAG_TYPE_COLORS } from '@/lib/shared/types'
import { hapticLight } from '@/lib/haptics'
import { useTheme } from '@/lib/shared/theme'

interface Props {
  readonly value: UnifiedTab
  readonly onChange: (tab: UnifiedTab) => void
  readonly visibleTabs: readonly UnifiedTab[]
  readonly promotedTags?: readonly StoryTag[]
  readonly selectedPromotedTag?: SelectedPromotedTag | null
  readonly onPromotedTagChange?: (tag: SelectedPromotedTag | null) => void
}

const SPRING_CONFIG = { stiffness: 300, damping: 30 }

export function UnifiedTabBar({ value, onChange, visibleTabs, promotedTags, selectedPromotedTag, onPromotedTagChange }: Props) {
  const theme = useTheme()
  const scrollRef = useRef<ScrollView>(null)
  const underlineLeft = useSharedValue(0)
  const underlineWidth = useSharedValue(0)
  const tabMeasurements = useRef<Record<string, { x: number; width: number }>>({})

  const underlineStyle = useAnimatedStyle(() => ({
    left: underlineLeft.value,
    width: underlineWidth.value,
  }))

  const isPromotedTagActive = selectedPromotedTag !== null && selectedPromotedTag !== undefined

  // When active tab changes (e.g. from parent), sync underline position
  useEffect(() => {
    const key = isPromotedTagActive ? `ptag-${selectedPromotedTag.slug}:${selectedPromotedTag.type}` : value
    const measurement = tabMeasurements.current[key]
    if (measurement) {
      underlineLeft.value = withSpring(measurement.x, SPRING_CONFIG)
      underlineWidth.value = withSpring(measurement.width, SPRING_CONFIG)
    }
  }, [value, selectedPromotedTag, isPromotedTagActive, underlineLeft, underlineWidth])

  const handleLayout = useCallback((key: string, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout
    tabMeasurements.current[key] = { x, width }

    const activeKey = isPromotedTagActive ? `ptag-${selectedPromotedTag?.slug}:${selectedPromotedTag?.type}` : value
    if (key === activeKey) {
      underlineLeft.value = x
      underlineWidth.value = width
    }
  }, [value, isPromotedTagActive, selectedPromotedTag, underlineLeft, underlineWidth])

  const handleTabPress = useCallback((tab: UnifiedTab) => {
    hapticLight()
    const measurement = tabMeasurements.current[tab]
    if (measurement) {
      underlineLeft.value = withSpring(measurement.x, SPRING_CONFIG)
      underlineWidth.value = withSpring(measurement.width, SPRING_CONFIG)
      scrollRef.current?.scrollTo({ x: Math.max(0, measurement.x - 40), animated: true })
    }
    if (onPromotedTagChange) onPromotedTagChange(null)
    onChange(tab)
  }, [onChange, onPromotedTagChange, underlineLeft, underlineWidth])

  const handlePromotedTagPress = useCallback((tag: StoryTag) => {
    hapticLight()
    const isAlreadyActive = isPromotedTagActive && selectedPromotedTag?.slug === tag.slug && selectedPromotedTag?.type === tag.type

    if (isAlreadyActive) {
      // Deselect — snap underline back to current feed tab
      const tabMeasurement = tabMeasurements.current[value]
      if (tabMeasurement) {
        underlineLeft.value = withSpring(tabMeasurement.x, SPRING_CONFIG)
        underlineWidth.value = withSpring(tabMeasurement.width, SPRING_CONFIG)
      }
      if (onPromotedTagChange) onPromotedTagChange(null)
    } else {
      const key = `ptag-${tag.slug}:${tag.type}`
      const measurement = tabMeasurements.current[key]
      if (measurement) {
        underlineLeft.value = withSpring(measurement.x, SPRING_CONFIG)
        underlineWidth.value = withSpring(measurement.width, SPRING_CONFIG)
        scrollRef.current?.scrollTo({ x: Math.max(0, measurement.x - 40), animated: true })
      }
      if (onPromotedTagChange) onPromotedTagChange({ slug: tag.slug, type: tag.type })
    }
  }, [onPromotedTagChange, underlineLeft, underlineWidth, isPromotedTagActive, selectedPromotedTag, value])

  const hasPromotedTags = promotedTags && promotedTags.length > 0

  return (
    <View style={{
      borderBottomWidth: 0.5,
      borderBottomColor: theme.surface.border,
    }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {visibleTabs.map((tab) => {
            const isActive = !isPromotedTagActive && value === tab
            return (
              <Pressable
                key={tab}
                testID={`feed-tab-${tab}`}
                onPress={() => handleTabPress(tab)}
                onLayout={(e) => handleLayout(tab, e)}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Inter',
                    fontSize: 13,
                    color: isActive ? theme.text.primary : theme.text.tertiary,
                  }}
                >
                  {getUnifiedTabLabel(tab)}
                </Text>
              </Pressable>
            )
          })}

          {/* Divider + promoted tags */}
          {hasPromotedTags && (
            <>
              <View style={{ paddingHorizontal: 6, justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, color: theme.text.muted }}>{'·'}</Text>
              </View>
              {promotedTags.map((tag) => {
                const key = `ptag-${tag.slug}:${tag.type}`
                const isActive = isPromotedTagActive && selectedPromotedTag?.slug === tag.slug && selectedPromotedTag?.type === tag.type
                const dotColor = TAG_TYPE_COLORS[tag.type]
                return (
                  <Pressable
                    key={key}
                    testID={`promoted-tab-${tag.slug}`}
                    onPress={() => handlePromotedTagPress(tag)}
                    onLayout={(e) => handleLayout(key, e)}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <View style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: dotColor,
                    }} />
                    <Text
                      style={{
                        fontFamily: 'Inter',
                        fontSize: 13,
                        color: isActive ? theme.text.primary : theme.text.tertiary,
                      }}
                    >
                      {tag.label}
                    </Text>
                  </Pressable>
                )
              })}
            </>
          )}
        </View>

        {/* Animated underline */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              bottom: 0,
              left: 0,
              height: 2,
              backgroundColor: theme.text.primary,
            },
            underlineStyle,
          ]}
        />
      </ScrollView>
    </View>
  )
}
