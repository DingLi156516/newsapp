import { useCallback } from 'react'
import { Pressable, Share, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated'
import { Share2 } from 'lucide-react-native'
import { hapticLight } from '@/lib/haptics'
import { SITE_URL, TOUCH_TARGET } from '@/lib/shared/design'

interface ShareButtonProps {
  readonly url: string
  readonly title: string
  readonly size?: number
}

export function ShareButton({ url, title, size = 20 }: ShareButtonProps) {
  const scale = useSharedValue(1)
  const ringScale = useSharedValue(0.5)
  const ringOpacity = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const ringStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    width: size * 2,
    height: size * 2,
    borderRadius: size,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }))

  const handleShare = useCallback(async () => {
    scale.value = withSequence(
      withTiming(0.75, { duration: 80 }),
      withSpring(1.15, { damping: 8 }),
      withSpring(1, { damping: 15 })
    )
    ringScale.value = 0.5
    ringOpacity.value = 0.4
    ringScale.value = withTiming(2.0, { duration: 400 })
    ringOpacity.value = withTiming(0, { duration: 400 })
    hapticLight()

    const fullUrl = url.startsWith('/') ? `${SITE_URL}${url}` : url

    try {
      await Share.share({
        message: `${title}\n${fullUrl}`,
        url: fullUrl,
      })
    } catch {
      // User cancelled or share failed
    }
  }, [url, title, scale, ringScale, ringOpacity])

  return (
    <Pressable
      onPress={handleShare}
      hitSlop={TOUCH_TARGET.hitSlop}
      testID="share-button"
      accessibilityLabel="Share story"
      accessibilityRole="button"
      style={styles.container}
    >
      <Animated.View style={ringStyle} />
      <Animated.View style={animatedStyle}>
        <Share2 size={size} color="rgba(255, 255, 255, 0.4)" />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    minWidth: TOUCH_TARGET.min,
    minHeight: TOUCH_TARGET.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
