/**
 * SegmentedControl — row of `Pill`s with a single active selection.
 * Wraps the sort-mode row and any similar mutually-exclusive toggle.
 */

import { View, type StyleProp, type ViewStyle } from 'react-native'
import { Pill } from '@/lib/ui/primitives/Pill'
import { SPACING } from '@/lib/ui/tokens'

export interface SegmentedControlOption<T extends string> {
  readonly value: T
  readonly label: string
}

export interface SegmentedControlProps<T extends string> {
  readonly value: T
  readonly onChange: (next: T) => void
  readonly options: readonly SegmentedControlOption<T>[]
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  style,
  testID,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="tablist"
      testID={testID}
      style={[{ flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' }, style]}
    >
      {options.map((option) => (
        <Pill
          key={option.value}
          label={option.label}
          active={option.value === value}
          onPress={() => onChange(option.value)}
          testID={testID ? `${testID}-${option.value}` : undefined}
        />
      ))}
    </View>
  )
}
