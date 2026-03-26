/**
 * UnifiedTabBar — Horizontally scrollable tab bar for feeds and topics
 * with animated sliding underline. Replaces FeedTabs + TopicPills.
 */

import { useRef, useCallback, useEffect } from 'react'
import { ScrollView, View, Text, Pressable, type LayoutChangeEvent } from 'react-native'
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated'
import type { UnifiedTab } from '@/lib/shared/types'
import { getUnifiedTabLabel } from '@/lib/shared/types'
import { hapticLight } from '@/lib/haptics'

interface Props {
  readonly value: UnifiedTab
  readonly onChange: (tab: UnifiedTab) => void
  readonly visibleTabs: readonly UnifiedTab[]
}

const SPRING_CONFIG = { stiffness: 300, damping: 30 }

export function UnifiedTabBar({ value, onChange, visibleTabs }: Props) {
  const scrollRef = useRef<ScrollView>(null)
  const underlineLeft = useSharedValue(0)
  const underlineWidth = useSharedValue(0)
  const tabMeasurements = useRef<Record<string, { x: number; width: number }>>({})

  const underlineStyle = useAnimatedStyle(() => ({
    left: underlineLeft.value,
    width: underlineWidth.value,
  }))

  // When active tab changes (e.g. from parent), sync underline position
  useEffect(() => {
    const measurement = tabMeasurements.current[value]
    if (measurement) {
      underlineLeft.value = withSpring(measurement.x, SPRING_CONFIG)
      underlineWidth.value = withSpring(measurement.width, SPRING_CONFIG)
    }
  }, [value, underlineLeft, underlineWidth])

  const handleLayout = useCallback((tab: UnifiedTab, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout
    tabMeasurements.current[tab] = { x, width }

    // Set initial underline position for the active tab (no animation)
    if (tab === value) {
      underlineLeft.value = x
      underlineWidth.value = width
    }
  }, [value, underlineLeft, underlineWidth])

  const handlePress = useCallback((tab: UnifiedTab) => {
    hapticLight()
    const measurement = tabMeasurements.current[tab]
    if (measurement) {
      underlineLeft.value = withSpring(measurement.x, SPRING_CONFIG)
      underlineWidth.value = withSpring(measurement.width, SPRING_CONFIG)

      // Auto-scroll to keep active tab visible
      scrollRef.current?.scrollTo({ x: Math.max(0, measurement.x - 40), animated: true })
    }
    onChange(tab)
  }, [onChange, underlineLeft, underlineWidth])

  return (
    <View style={{
      borderBottomWidth: 0.5,
      borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        <View style={{ flexDirection: 'row' }}>
          {visibleTabs.map((tab) => {
            const isActive = value === tab
            return (
              <Pressable
                key={tab}
                testID={`feed-tab-${tab}`}
                onPress={() => handlePress(tab)}
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
                    color: isActive ? 'white' : 'rgba(255, 255, 255, 0.5)',
                  }}
                >
                  {getUnifiedTabLabel(tab)}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* Animated underline — positioned absolutely within ScrollView content */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              bottom: 0,
              left: 0,
              height: 2,
              backgroundColor: 'white',
            },
            underlineStyle,
          ]}
        />
      </ScrollView>
    </View>
  )
}
