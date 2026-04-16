import { Pressable, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated'
import { Bookmark } from 'lucide-react-native'
import { hapticLight, hapticMedium } from '@/lib/haptics'
import { TOUCH_TARGET } from '@/lib/shared/design'
import { useTheme } from '@/lib/shared/theme'

interface BookmarkButtonProps {
  readonly isSaved: boolean
  readonly onPress: () => void
  readonly size?: number
}

export function BookmarkButton({ isSaved, onPress, size = 20 }: BookmarkButtonProps) {
  const theme = useTheme()
  // Capture for worklet (cannot access React context inside useAnimatedStyle)
  const ringColor = theme.text.tertiary

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
    borderColor: ringColor,
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }))

  const handlePress = () => {
    const saving = !isSaved
    if (saving) {
      scale.value = withSequence(
        withTiming(0.75, { duration: 80 }),
        withSpring(1.15, { damping: 8 }),
        withSpring(1, { damping: 15 })
      )
      ringScale.value = 0.5
      ringOpacity.value = 0.5
      ringScale.value = withTiming(2.0, { duration: 400 })
      ringOpacity.value = withTiming(0, { duration: 400 })
      hapticMedium()
    } else {
      scale.value = withSequence(
        withTiming(0.85, { duration: 60 }),
        withSpring(1, { damping: 15 })
      )
      hapticLight()
    }
    onPress()
  }

  return (
    <Pressable
      testID="bookmark-button"
      onPress={handlePress}
      hitSlop={TOUCH_TARGET.hitSlop}
      accessibilityLabel={isSaved ? 'Remove bookmark' : 'Bookmark story'}
      accessibilityRole="button"
      style={styles.container}
    >
      <Animated.View style={ringStyle} />
      <Animated.View style={animatedStyle}>
        <Bookmark
          size={size}
          color={isSaved ? theme.text.primary : theme.text.tertiary}
          fill={isSaved ? theme.text.primary : 'transparent'}
        />
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
