/**
 * Heading — display-typography wrapper around Text. Only allows the three
 * serif variants (`hero`, `display`, `title`) so screen titles have an
 * unmistakable call site and stay consistent.
 */

import { Text, type TextProps, type TextTone } from './Text'
import type { TextVariant } from '@/lib/ui/tokens'

type HeadingVariant = Extract<TextVariant, 'hero' | 'display' | 'title'>

export interface HeadingProps extends Omit<TextProps, 'variant' | 'tone'> {
  readonly variant: HeadingVariant
  readonly tone?: TextTone
}

export function Heading({ variant, tone = 'primary', ...rest }: HeadingProps) {
  return <Text variant={variant} tone={tone} {...rest} />
}
