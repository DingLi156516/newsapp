import { useCallback } from 'react'
import { Pressable, Share } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handleShare = useCallback(async () => {
    scale.value = withSpring(0.8, {}, () => {
      scale.value = withSpring(1)
    })
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
  }, [url, title, scale])

  return (
    <Pressable
      onPress={handleShare}
      hitSlop={TOUCH_TARGET.hitSlop}
      testID="share-button"
      accessibilityLabel="Share story"
      accessibilityRole="button"
      style={{ minWidth: TOUCH_TARGET.min, minHeight: TOUCH_TARGET.min, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={animatedStyle}>
        <Share2 size={size} color="rgba(255, 255, 255, 0.4)" />
      </Animated.View>
    </Pressable>
  )
}
