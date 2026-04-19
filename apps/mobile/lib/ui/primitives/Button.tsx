/**
 * Button — four variants (primary, secondary, destructive, ghost) × three
 * sizes. Ink-on-background for primary, glass for secondary, semantic.error
 * for destructive, transparent for ghost. Built-in press-scale + haptic.
 */

import { useCallback } from 'react'
import { Pressable, View, ActivityIndicator, type ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import type { LucideProps } from 'lucide-react-native'
import { useTheme } from '@/lib/shared/theme'
import { hapticLight } from '@/lib/haptics'
import { Text } from './Text'
import { DURATION, RADIUS, SPACING, TOUCH_TARGET } from '@/lib/ui/tokens'

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  readonly onPress: () => void
  readonly children: React.ReactNode
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  readonly icon?: React.ComponentType<LucideProps>
  readonly loading?: boolean
  readonly disabled?: boolean
  readonly fullWidth?: boolean
  readonly testID?: string
  readonly accessibilityLabel?: string
}

const SIZE_SHAPE: Record<ButtonSize, { paddingV: number; paddingH: number; iconSize: number }> = {
  sm: { paddingV: SPACING.xs + 2, paddingH: SPACING.md, iconSize: 14 },
  md: { paddingV: SPACING.sm + 2, paddingH: SPACING.lg, iconSize: 16 },
  lg: { paddingV: SPACING.md + 2, paddingH: SPACING.xl, iconSize: 18 },
}

const PRESS_SCALE = 0.97

export function Button({
  onPress,
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const theme = useTheme()
  const scale = useSharedValue(1)
  const shape = SIZE_SHAPE[size]

  const colors = {
    primary: {
      bg: theme.text.primary,
      fg: theme.surface.background,
      border: 'transparent',
    },
    secondary: {
      bg: theme.surface.glass,
      fg: theme.text.primary,
      border: theme.surface.border,
    },
    destructive: {
      bg: theme.semantic.error.bg,
      fg: theme.semantic.error.color,
      border: theme.semantic.error.border,
    },
    ghost: {
      bg: 'transparent',
      fg: theme.text.secondary,
      border: 'transparent',
    },
  }[variant]

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs + 2,
    backgroundColor: colors.bg,
    borderWidth: variant === 'secondary' || variant === 'destructive' ? 0.5 : 0,
    borderColor: colors.border,
    borderRadius: RADIUS.md,
    paddingVertical: shape.paddingV,
    paddingHorizontal: shape.paddingH,
    minHeight: TOUCH_TARGET.min,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    opacity: disabled ? 0.5 : 1,
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(PRESS_SCALE, { duration: DURATION.fast })
  }, [scale])

  const handlePressOut = useCallback(() => {
    scale.value = withTiming(1, { duration: DURATION.fast })
  }, [scale])

  const handlePress = useCallback(() => {
    if (disabled || loading) return
    hapticLight()
    onPress()
  }, [disabled, loading, onPress])

  const labelTone = variant === 'destructive' ? 'primary' : 'primary'

  return (
    <Animated.View style={[{ alignSelf: fullWidth ? 'stretch' : 'flex-start' }, animatedStyle]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        testID={testID}
        style={containerStyle}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.fg} />
        ) : (
          <>
            {Icon && (
              <View>
                <Icon size={shape.iconSize} color={colors.fg} />
              </View>
            )}
            <Text variant="heading" tone={labelTone} style={{ color: colors.fg }}>
              {children}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  )
}
