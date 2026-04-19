/**
 * Divider — thin ink-tint line, horizontal or vertical.
 *
 * New primitive introduced for the Blindspot filter-row split (skew ↕ topic).
 */

import { View, type ViewStyle } from 'react-native'
import { useTheme } from '@/lib/shared/theme'
import { INK_TINT, type InkTintKey } from '@/lib/ui/tokens'

export interface DividerProps {
  readonly orientation?: 'horizontal' | 'vertical'
  readonly inset?: number
  readonly tone?: Extract<InkTintKey, 'whisper' | 'subtle' | 'soft' | 'standard' | 'strong'>
  readonly style?: ViewStyle
  readonly testID?: string
}

export function Divider({
  orientation = 'horizontal',
  inset = 0,
  tone = 'subtle',
  style,
  testID,
}: DividerProps) {
  const theme = useTheme()
  const color = `rgba(${theme.inkRgb}, ${INK_TINT[tone]})`

  const base: ViewStyle =
    orientation === 'vertical'
      ? { width: 1, alignSelf: 'stretch', marginHorizontal: inset, backgroundColor: color }
      : { height: 1, alignSelf: 'stretch', marginVertical: inset, backgroundColor: color }

  return <View testID={testID} style={[base, style]} />
}
