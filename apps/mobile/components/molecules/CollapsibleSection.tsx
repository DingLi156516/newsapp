/**
 * CollapsibleSection — Animated expand/collapse container.
 *
 * Key mobile-native building block used by HeadlineComparisonList,
 * ClaimsComparison, and StoryScores. Uses reanimated for smooth
 * height animation and chevron rotation, with haptic feedback on toggle.
 */

import { useState, useCallback, type ReactNode } from 'react'
import { View, Text, Pressable } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import { hapticLight } from '@/lib/haptics'
import { ChevronDown } from 'lucide-react-native'
import { GlassView } from '@/components/ui/GlassView'
import { ANIMATION, SPACING, FONT } from '@/lib/shared/design'

interface Props {
  readonly title: string
  readonly subtitle?: string
  readonly defaultExpanded?: boolean
  readonly children: ReactNode
}

export function CollapsibleSection({ title, subtitle, defaultExpanded = false, children }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const rotation = useSharedValue(defaultExpanded ? 180 : 0)

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  const toggle = useCallback(() => {
    const next = !expanded
    setExpanded(next)
    rotation.value = withSpring(next ? 180 : 0, ANIMATION.springStiff)
    hapticLight()
  }, [expanded, rotation])

  return (
    <GlassView style={{ overflow: 'hidden' }}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${expanded ? 'collapse' : 'expand'}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: SPACING.lg,
          paddingVertical: SPACING.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{
            fontFamily: 'Inter-SemiBold',
            fontSize: FONT.body.size,
            color: 'rgba(255, 255, 255, 0.9)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            {title}
          </Text>
          {subtitle && (
            <Text style={{
              fontFamily: FONT.caption.family,
              fontSize: FONT.caption.size,
              color: 'rgba(255, 255, 255, 0.4)',
              marginTop: 2,
            }}>
              {subtitle}
            </Text>
          )}
        </View>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={18} color="rgba(255, 255, 255, 0.5)" />
        </Animated.View>
      </Pressable>

      {expanded && (
        <View style={{
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(255, 255, 255, 0.06)',
        }}>
          {children}
        </View>
      )}
    </GlassView>
  )
}
