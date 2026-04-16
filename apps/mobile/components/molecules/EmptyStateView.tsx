/**
 * EmptyStateView — Shown when a list has no results.
 * Staggered entrance animations + ambient icon circle pulse.
 */

import { useEffect } from 'react'
import { View, Text, Pressable } from 'react-native'
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { SearchX, Inbox, BookOpen, Zap, Bookmark } from 'lucide-react-native'
import { useTheme } from '@/lib/shared/theme'

interface Props {
  readonly message: string
  readonly title?: string
  readonly icon?: 'search' | 'inbox' | 'book' | 'lightning' | 'bookmark'
  readonly actionLabel?: string
  readonly onAction?: () => void
}

const ICON_MAP = { search: SearchX, inbox: Inbox, book: BookOpen, lightning: Zap, bookmark: Bookmark } as const

export function EmptyStateView({ message, title, icon = 'search', actionLabel, onAction }: Props) {
  const theme = useTheme()
  const Icon = ICON_MAP[icon]
  const pulseOpacity = useSharedValue(0.5)

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withTiming(1, { duration: 2000 }),
      -1,
      true
    )
  }, [pulseOpacity])

  // Capture for worklet (cannot access React context inside useAnimatedStyle)
  const pulseBackground = theme.surface.border

  const circleStyle = useAnimatedStyle(() => ({
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: pulseBackground,
    opacity: pulseOpacity.value,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 4,
  }))

  return (
    <View style={{ padding: 48, alignItems: 'center', gap: 12 }}>
      <Animated.View entering={FadeIn.delay(100).springify()} style={circleStyle}>
        <Icon size={32} color={theme.text.muted} />
      </Animated.View>
      {title && (
        <Animated.Text
          entering={FadeInDown.delay(200).duration(400)}
          style={{ fontFamily: 'DMSerifDisplay', fontSize: 18, color: theme.text.primary, textAlign: 'center' }}
        >
          {title}
        </Animated.Text>
      )}
      <Animated.Text
        entering={FadeInDown.delay(300).duration(400)}
        style={{ fontFamily: 'Inter', fontSize: 13, color: theme.text.secondary, textAlign: 'center', lineHeight: 20, maxWidth: 240 }}
      >
        {message}
      </Animated.Text>
      {actionLabel && onAction && (
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <Pressable
            onPress={onAction}
            testID="empty-state-action"
            style={{ marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.surface.border }}
          >
            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.text.primary }}>{actionLabel}</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  )
}
