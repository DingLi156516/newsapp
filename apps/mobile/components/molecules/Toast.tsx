/**
 * Toast — Glassmorphic notification that slides up from bottom.
 * Variants: success (green), info (blue), warning (amber), error (red).
 * Optional undo action for destructive operations.
 *
 * Reads semantic + surface colors and blur tint from `useTheme()` so the
 * toast follows the active theme.
 */

import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import { CheckCircle, Info, AlertTriangle, XCircle } from 'lucide-react-native'
import { hapticLight } from '@/lib/haptics'
import { useEffect } from 'react'
import type { ToastData, ToastVariant } from '@/lib/hooks/use-toast'
import {
  BORDER_RADIUS,
  SPACING,
  FONT,
  ANIMATION,
  TOUCH_TARGET,
} from '@/lib/shared/design'
import { useTheme } from '@/lib/shared/theme'

const ICON_MAP: Record<ToastVariant, typeof CheckCircle> = {
  success: CheckCircle,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
}

interface ToastProps {
  readonly toast: ToastData
  readonly onDismiss: () => void
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const theme = useTheme()
  const variant = toast.variant
  const semantic = theme.semantic[variant]
  const Icon = ICON_MAP[variant]

  useEffect(() => {
    hapticLight()
  }, [toast.id])

  const handleUndo = () => {
    toast.onUndo?.()
    onDismiss()
  }

  const handleAction = () => {
    toast.onAction?.()
    onDismiss()
  }

  const content = (
    <>
      {/* Left accent stripe */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: SPACING.xs + 2,
          bottom: SPACING.xs + 2,
          width: 3,
          borderTopRightRadius: 2,
          borderBottomRightRadius: 2,
          backgroundColor: semantic.color,
          opacity: 0.6,
        }}
      />

      {/* Icon container */}
      <View
        testID={`toast-icon-${variant}`}
        style={{
          width: 28,
          height: 28,
          borderRadius: BORDER_RADIUS.sm,
          backgroundColor: semantic.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={14} color={semantic.color} />
      </View>

      {/* Message */}
      <Text
        style={{
          flex: 1,
          fontFamily: FONT.body.family,
          fontSize: FONT.body.size,
          color: theme.text.primary,
        }}
      >
        {toast.message}
      </Text>

      {/* Undo button */}
      {toast.onUndo && (
        <Pressable
          onPress={handleUndo}
          hitSlop={TOUCH_TARGET.hitSlop}
          testID="toast-undo"
        >
          <Text
            style={{
              fontFamily: 'Inter-SemiBold',
              fontSize: 13,
              color: semantic.color,
              paddingVertical: SPACING.xs + 1,
              paddingHorizontal: SPACING.md,
              borderRadius: BORDER_RADIUS.xs + 2,
              backgroundColor: semantic.bg,
              overflow: 'hidden',
            }}
          >
            Undo
          </Text>
        </Pressable>
      )}

      {/* Custom action button */}
      {toast.onAction && toast.actionLabel && (
        <Pressable
          onPress={handleAction}
          hitSlop={TOUCH_TARGET.hitSlop}
          testID="toast-action"
        >
          <Text
            style={{
              fontFamily: 'Inter-SemiBold',
              fontSize: 13,
              color: semantic.color,
              paddingVertical: SPACING.xs + 1,
              paddingHorizontal: SPACING.md,
              borderRadius: BORDER_RADIUS.xs + 2,
              backgroundColor: semantic.bg,
              overflow: 'hidden',
            }}
          >
            {toast.actionLabel}
          </Text>
        </Pressable>
      )}
    </>
  )

  const containerStyle = {
    position: 'absolute' as const,
    bottom: 100,
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 0.5,
    borderColor: theme.surface.border,
    overflow: 'hidden' as const,
  }

  return (
    <Animated.View
      entering={SlideInDown.springify()
        .damping(ANIMATION.springBouncy.damping)
        .stiffness(ANIMATION.springBouncy.stiffness)}
      exiting={SlideOutDown.duration(ANIMATION.fadeOut)}
      accessibilityRole="alert"
      accessibilityLabel={toast.message}
      style={containerStyle}
    >
      {/* Glass background layer */}
      {Platform.OS === 'ios' ? (
        <BlurView intensity={20} tint={theme.blurTint} style={StyleSheet.absoluteFill} />
      ) : null}

      {/* Variant gradient overlay */}
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: theme.surface.glass,
        }}
      />
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: semantic.bg,
          opacity: 0.6,
        }}
      />

      {content}
    </Animated.View>
  )
}
