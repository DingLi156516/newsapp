/**
 * AISummaryTabs — Tabbed AI perspective summary panel with animated underline.
 * Common Ground | Left | Right
 */

import { useState, useRef, useCallback } from 'react'
import { View, Text, Pressable, type LayoutChangeEvent } from 'react-native'
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated'
import { GlassView } from '@/components/ui/GlassView'

interface Props {
  readonly commonGround: string
  readonly leftFraming: string
  readonly rightFraming: string
}

type TabId = 'common' | 'left' | 'right'

const TABS: { id: TabId; label: string }[] = [
  { id: 'common', label: 'Common Ground' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
]

const SPRING_CONFIG = { stiffness: 300, damping: 30 }

function ContentBlock({ content }: { content: string }) {
  const lines = content.split('\n').filter((l) => l.trim())
  return (
    <View style={{ gap: 8 }}>
      {lines.map((line, i) => (
        <Text key={i} style={{ fontFamily: 'Inter', fontSize: 13, lineHeight: 20, color: 'rgba(255, 255, 255, 0.8)' }}>
          {line.startsWith('•') ? line : `• ${line}`}
        </Text>
      ))}
    </View>
  )
}

export function AISummaryTabs({ commonGround, leftFraming, rightFraming }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('common')
  const underlineX = useSharedValue(0)
  const underlineWidth = useSharedValue(0)
  const tabMeasurements = useRef<Record<string, { x: number; width: number }>>({})

  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: underlineX.value }],
    width: underlineWidth.value,
  }))

  const handleLayout = useCallback((tabId: TabId, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout
    tabMeasurements.current[tabId] = { x, width }

    if (tabId === activeTab) {
      underlineX.value = withSpring(x, SPRING_CONFIG)
      underlineWidth.value = withSpring(width, SPRING_CONFIG)
    }
  }, [activeTab, underlineX, underlineWidth])

  const handlePress = useCallback((tabId: TabId) => {
    const measurement = tabMeasurements.current[tabId]
    if (measurement) {
      underlineX.value = withSpring(measurement.x, SPRING_CONFIG)
      underlineWidth.value = withSpring(measurement.width, SPRING_CONFIG)
    }
    setActiveTab(tabId)
  }, [underlineX, underlineWidth])

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
        borderBottomColor: 'rgba(255, 255, 255, 0.06)',
        position: 'relative',
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <Pressable
              key={tab.id}
              onPress={() => handlePress(tab.id)}
              onLayout={(e) => handleLayout(tab.id, e)}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{
                fontFamily: 'Inter',
                fontSize: 13,
                color: isActive ? 'white' : 'rgba(255, 255, 255, 0.5)',
              }}>
                {tab.label}
              </Text>
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
              backgroundColor: 'rgba(255, 255, 255, 0.6)',
            },
            underlineStyle,
          ]}
        />
      </View>

      {/* Tab content */}
      <Animated.View
        key={activeTab}
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(100)}
        style={{ padding: 20, minHeight: 120 }}
      >
        <ContentBlock content={content[activeTab]} />
      </Animated.View>
    </GlassView>
  )
}
