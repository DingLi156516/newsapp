/**
 * AISummaryTabs — Tabbed AI perspective summary panel with animated underline.
 * Common Ground | Left | Right
 *
 * Users can switch tabs by tapping, or by horizontal swipe. A one-time
 * "← swipe →" affordance appears on first view and disappears after the
 * user interacts (persisted via AsyncStorage).
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { View, Text, Pressable, type LayoutChangeEvent } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { GlassView } from '@/components/ui/GlassView'
import { SentimentPill } from '@/components/atoms/SentimentPill'
import type { StorySentiment } from '@/lib/shared/types'
import { useTheme } from '@/lib/shared/theme'

interface Props {
  readonly commonGround: string
  readonly leftFraming: string
  readonly rightFraming: string
  readonly sentiment?: StorySentiment | null
  readonly sourceCount?: number
}

type TabId = 'common' | 'left' | 'right'

const MULTI_SOURCE_TABS: { id: TabId; label: string }[] = [
  { id: 'common', label: 'Common Ground' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
]

const SINGLE_SOURCE_TABS: { id: TabId; label: string }[] = [
  { id: 'common', label: 'Summary' },
]

const SPRING_CONFIG = { stiffness: 300, damping: 30 }
const SWIPE_THRESHOLD = 50
const SWIPE_VELOCITY_THRESHOLD = 500
const AFFORDANCE_STORAGE_KEY = '@axiom/ai-perspective-swipe-seen'

function ContentBlock({ content }: { content: string }) {
  const theme = useTheme()
  const lines = content.split('\n').filter((l) => l.trim())
  return (
    <View style={{ gap: 8 }}>
      {lines.map((line, i) => (
        <Text key={i} style={{ fontFamily: 'Inter', fontSize: 13, lineHeight: 20, color: theme.text.primary }}>
          {line.startsWith('•') ? line : `• ${line}`}
        </Text>
      ))}
    </View>
  )
}

export function AISummaryTabs({ commonGround, leftFraming, rightFraming, sentiment, sourceCount }: Props) {
  const theme = useTheme()
  const [activeTab, setActiveTab] = useState<TabId>('common')
  const [affordanceSeen, setAffordanceSeen] = useState(true)
  const underlineX = useSharedValue(0)
  const underlineWidth = useSharedValue(0)
  const tabMeasurements = useRef<Record<string, { x: number; width: number }>>({})

  const isSingleSource = sourceCount === 1
  const tabs = isSingleSource ? SINGLE_SOURCE_TABS : MULTI_SOURCE_TABS

  useEffect(() => {
    if (isSingleSource) return
    AsyncStorage.getItem(AFFORDANCE_STORAGE_KEY)
      .then((seen) => setAffordanceSeen(seen === '1'))
      .catch(() => setAffordanceSeen(true))
  }, [isSingleSource])

  const markAffordanceSeen = useCallback(() => {
    setAffordanceSeen(true)
    AsyncStorage.setItem(AFFORDANCE_STORAGE_KEY, '1').catch(() => {})
  }, [])

  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: underlineX.value }],
    width: underlineWidth.value,
  }))

  const goToTab = useCallback((tabId: TabId) => {
    const measurement = tabMeasurements.current[tabId]
    if (measurement) {
      underlineX.value = withSpring(measurement.x, SPRING_CONFIG)
      underlineWidth.value = withSpring(measurement.width, SPRING_CONFIG)
    }
    setActiveTab(tabId)
    markAffordanceSeen()
  }, [underlineX, underlineWidth, markAffordanceSeen])

  const handleLayout = useCallback((tabId: TabId, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout
    tabMeasurements.current[tabId] = { x, width }

    if (tabId === activeTab) {
      underlineX.value = withSpring(x, SPRING_CONFIG)
      underlineWidth.value = withSpring(width, SPRING_CONFIG)
    }
  }, [activeTab, underlineX, underlineWidth])

  const advanceTab = useCallback((direction: 1 | -1) => {
    if (isSingleSource) return
    const ids = tabs.map((t) => t.id)
    const idx = ids.indexOf(activeTab)
    const nextIdx = idx + direction
    if (nextIdx < 0 || nextIdx >= ids.length) return
    goToTab(ids[nextIdx])
  }, [activeTab, tabs, goToTab, isSingleSource])

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .enabled(!isSingleSource)
    .onEnd((event) => {
      const dx = event.translationX
      const vx = event.velocityX
      if (dx <= -SWIPE_THRESHOLD || vx <= -SWIPE_VELOCITY_THRESHOLD) {
        runOnJS(advanceTab)(1)
      } else if (dx >= SWIPE_THRESHOLD || vx >= SWIPE_VELOCITY_THRESHOLD) {
        runOnJS(advanceTab)(-1)
      }
    })

  const content: Record<TabId, string> = {
    common: commonGround,
    left: leftFraming,
    right: rightFraming,
  }

  return (
    <GlassView style={{ overflow: 'hidden' }}>
      {/* Tab header */}
      <View style={{
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: theme.surface.border,
        position: 'relative',
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <Pressable
              key={tab.id}
              onPress={() => goToTab(tab.id)}
              onLayout={(e) => handleLayout(tab.id, e)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Text style={{
                fontFamily: 'Inter',
                fontSize: 13,
                color: isActive ? theme.text.primary : theme.text.tertiary,
              }}>
                {tab.label}
              </Text>
              {sentiment && tab.id === 'left' && (
                <SentimentPill sentiment={sentiment.left} />
              )}
              {sentiment && tab.id === 'right' && (
                <SentimentPill sentiment={sentiment.right} />
              )}
            </Pressable>
          )
        })}

        {/* Animated underline */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              bottom: 0,
              height: 1,
              backgroundColor: `rgba(${theme.inkRgb}, 0.6)`,
            },
            underlineStyle,
          ]}
        />
      </View>

      {/* Tab content with swipe gesture */}
      <GestureDetector gesture={swipeGesture}>
        <Animated.View
          key={activeTab}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(100)}
          style={{ padding: 20, minHeight: 120 }}
        >
          <ContentBlock content={content[activeTab]} />
          {!affordanceSeen && !isSingleSource && (
            <Text
              testID="ai-summary-swipe-affordance"
              style={{
                fontFamily: 'Inter',
                fontSize: 10,
                color: theme.text.muted,
                textAlign: 'center',
                marginTop: 12,
                letterSpacing: 1,
              }}
            >
              {'← swipe →'}
            </Text>
          )}
        </Animated.View>
      </GestureDetector>
    </GlassView>
  )
}
