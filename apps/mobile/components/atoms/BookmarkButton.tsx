import { Pressable } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { Bookmark } from 'lucide-react-native'
import { hapticLight } from '@/lib/haptics'
import { TOUCH_TARGET } from '@/lib/shared/design'

interface BookmarkButtonProps {
  readonly isSaved: boolean
  readonly onPress: () => void
  readonly size?: number
}

export function BookmarkButton({ isSaved, onPress, size = 20 }: BookmarkButtonProps) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePress = () => {
    scale.value = withSpring(0.8, {}, () => {
      scale.value = withSpring(1)
    })
    hapticLight()
    onPress()
  }

  return (
    <Pressable
      testID="bookmark-button"
      onPress={handlePress}
      hitSlop={TOUCH_TARGET.hitSlop}
      accessibilityLabel={isSaved ? 'Remove bookmark' : 'Bookmark story'}
      accessibilityRole="button"
      style={{ minWidth: TOUCH_TARGET.min, minHeight: TOUCH_TARGET.min, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={animatedStyle}>
        <Bookmark
          size={size}
          color={isSaved ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)'}
          fill={isSaved ? '#FFFFFF' : 'transparent'}
        />
      </Animated.View>
    </Pressable>
  )
}
