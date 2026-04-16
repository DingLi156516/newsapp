/**
 * SwipeableCard — Gesture wrapper for feed cards.
 * Swipe right to bookmark, swipe left to share.
 * Uses reanimated gesture-handler v2 Pan gesture.
 */

import { type ReactNode, useCallback, useMemo } from 'react'
import { StyleSheet, View, Share } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated'
import { Bookmark, Share2 } from 'lucide-react-native'
import { hapticLight, hapticSuccess } from '@/lib/haptics'
import { SITE_URL } from '@/lib/shared/design'

const THRESHOLD = 60
const MAX_TRANSLATE = 100

interface SwipeableCardProps {
  readonly children: ReactNode
  readonly storyId: string
  readonly storyTitle: string
  readonly isSaved: boolean
  readonly onSave: (id: string) => void
}

export function SwipeableCard({ children, storyId, storyTitle, isSaved, onSave }: SwipeableCardProps) {
  const translateX = useSharedValue(0)
  const hasPassedThreshold = useSharedValue(false)

  const triggerSave = useCallback(() => {
    onSave(storyId)
    hapticSuccess()
  }, [storyId, onSave])

  const triggerShare = useCallback(async () => {
    hapticSuccess()
    const fullUrl = `${SITE_URL}/story/${storyId}`
    try {
      await Share.share({ message: `${storyTitle}\n${fullUrl}`, url: fullUrl })
    } catch {
      // User cancelled
    }
  }, [storyId, storyTitle])

  const thresholdHaptic = useCallback(() => {
    hapticLight()
  }, [])

  const panGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      const clamped = Math.max(-MAX_TRANSLATE, Math.min(MAX_TRANSLATE, event.translationX))
      translateX.value = clamped

      const crossed = Math.abs(clamped) >= THRESHOLD
      if (crossed && !hasPassedThreshold.value) {
        hasPassedThreshold.value = true
        runOnJS(thresholdHaptic)()
      } else if (!crossed && hasPassedThreshold.value) {
        hasPassedThreshold.value = false
      }
    })
    .onEnd((event) => {
      const clamped = Math.max(-MAX_TRANSLATE, Math.min(MAX_TRANSLATE, event.translationX))
      if (clamped >= THRESHOLD) {
        runOnJS(triggerSave)()
      } else if (clamped <= -THRESHOLD) {
        runOnJS(triggerShare)()
      }
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 })
      hasPassedThreshold.value = false
    }), [translateX, hasPassedThreshold, triggerSave, triggerShare, thresholdHaptic])

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  const leftRevealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, THRESHOLD], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(translateX.value, [0, THRESHOLD], [0.5, 1], Extrapolation.CLAMP) }],
  }))

  const rightRevealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(translateX.value, [-THRESHOLD, 0], [1, 0.5], Extrapolation.CLAMP) }],
  }))

  return (
    <View style={styles.wrapper}>
      {/* Left reveal — bookmark */}
      <Animated.View style={[styles.revealLeft, leftRevealStyle]}>
        <Bookmark
          size={22}
          color={isSaved ? '#60a5fa' : '#60a5fa'}
          fill={isSaved ? '#60a5fa' : 'transparent'}
        />
      </Animated.View>
      {/* Right reveal — share */}
      <Animated.View style={[styles.revealRight, rightRevealStyle]}>
        <Share2 size={22} color="#9ca3af" />
      </Animated.View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardStyle}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  revealLeft: {
    position: 'absolute',
    left: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
  },
  revealRight: {
    position: 'absolute',
    right: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
  },
})
