/**
 * IconButton — round icon target ≥44×44 (Apple HIG). Optional notification
 * badge. Used for header actions (filters, settings, back).
 */

import { Pressable, View, type ViewStyle } from 'react-native'
import type { LucideProps } from 'lucide-react-native'
import { useTheme } from '@/lib/shared/theme'
import { hapticLight } from '@/lib/haptics'
import { Text } from './Text'
import { INK_TINT, RADIUS, TOUCH_TARGET } from '@/lib/ui/tokens'

export type IconButtonTone = 'primary' | 'secondary' | 'tertiary' | 'accent'
export type IconButtonSize = 'sm' | 'md' | 'lg'

export interface IconButtonProps {
  readonly icon: React.ComponentType<LucideProps>
  readonly onPress: () => void
  readonly accessibilityLabel: string
  readonly tone?: IconButtonTone
  readonly size?: IconButtonSize
  readonly badge?: number
  readonly disabled?: boolean
  readonly testID?: string
}

const SIZE_SHAPE: Record<IconButtonSize, { box: number; iconSize: number }> = {
  sm: { box: 36, iconSize: 16 },
  md: { box: TOUCH_TARGET.min, iconSize: 20 },
  lg: { box: 52, iconSize: 24 },
}

export function IconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  tone = 'secondary',
  size = 'md',
  badge,
  disabled = false,
  testID,
}: IconButtonProps) {
  const theme = useTheme()
  const shape = SIZE_SHAPE[size]

  const color =
    tone === 'accent' ? theme.semantic.primary.color : theme.text[tone]

  const containerStyle: ViewStyle = {
    width: shape.box,
    height: shape.box,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.4 : 1,
  }

  const handlePress = () => {
    if (disabled) return
    hapticLight()
    onPress()
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={TOUCH_TARGET.hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [
        containerStyle,
        pressed && {
          backgroundColor: `rgba(${theme.inkRgb}, ${INK_TINT.soft})`,
        },
      ]}
    >
      <Icon size={shape.iconSize} color={color} />
      {typeof badge === 'number' && badge > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `rgba(${theme.inkRgb}, ${INK_TINT.strong})`,
          }}
        >
          <Text variant="badge" tone="primary">
            {badge > 99 ? '99+' : String(badge)}
          </Text>
        </View>
      )}
    </Pressable>
  )
}
