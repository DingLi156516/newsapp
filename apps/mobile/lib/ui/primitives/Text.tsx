/**
 * Text — typed text primitive wired to `TEXT_STYLES` + theme tones.
 *
 * Replaces the ~200 inline `{ fontFamily, fontSize, color }` triples
 * scattered across tab files with `<Text variant="body" tone="tertiary">`.
 */

import { Text as RNText, type TextProps as RNTextProps } from 'react-native'
import { useTheme } from '@/lib/shared/theme'
import { TEXT_STYLES, type TextVariant } from '@/lib/ui/tokens'

export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'muted' | 'accent'

export interface TextProps extends RNTextProps {
  readonly variant?: TextVariant
  readonly tone?: TextTone
}

export function Text({
  variant = 'body',
  tone = 'primary',
  style,
  children,
  ...rest
}: TextProps) {
  const theme = useTheme()
  const color =
    tone === 'accent' ? theme.semantic.primary.color : theme.text[tone]

  return (
    <RNText style={[TEXT_STYLES[variant], { color }, style]} {...rest}>
      {children}
    </RNText>
  )
}
