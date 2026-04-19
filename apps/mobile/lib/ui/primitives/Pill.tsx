/**
 * Pill — unified pill component replacing four hand-rolled copies
 * (sort pills, filter pills, active chips, blindspot filters).
 *
 * `active` toggles the filled-ink background. `dismissible` renders an ✕
 * glyph and treats `onPress` as the dismiss action. `leading` / `trailing`
 * slots accept arbitrary nodes (e.g. a small icon).
 */

import { Pressable, View, type ViewStyle } from 'react-native'
import { X } from 'lucide-react-native'
import { useTheme } from '@/lib/shared/theme'
import { hapticLight } from '@/lib/haptics'
import { Text } from './Text'
import { INK_TINT, RADIUS, SPACING, TOUCH_TARGET } from '@/lib/ui/tokens'

export interface PillProps {
  readonly label: string
  readonly active?: boolean
  readonly onPress?: () => void
  readonly leading?: React.ReactNode
  readonly trailing?: React.ReactNode
  readonly dismissible?: boolean
  readonly disabled?: boolean
  readonly testID?: string
  readonly accessibilityLabel?: string
}

export function Pill({
  label,
  active = false,
  onPress,
  leading,
  trailing,
  dismissible = false,
  disabled = false,
  testID,
  accessibilityLabel,
}: PillProps) {
  const theme = useTheme()

  const backgroundColor = active
    ? `rgba(${theme.inkRgb}, ${INK_TINT.standard})`
    : 'transparent'
  const borderColor = active ? theme.surface.borderPill : theme.surface.border
  const textTone = active ? 'primary' : 'tertiary'

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.pill,
    borderWidth: 0.5,
    borderColor,
    backgroundColor,
    opacity: disabled ? 0.5 : 1,
    minHeight: 28,
  }

  const handlePress = () => {
    if (disabled) return
    hapticLight()
    onPress?.()
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active, disabled }}
      hitSlop={TOUCH_TARGET.hitSlop}
      testID={testID}
      style={containerStyle}
    >
      {leading}
      <Text variant="bodySm" tone={textTone}>
        {label}
      </Text>
      {dismissible ? (
        <View style={{ marginLeft: 2 }}>
          <X size={12} color={theme.text[textTone]} />
        </View>
      ) : (
        trailing
      )}
    </Pressable>
  )
}
