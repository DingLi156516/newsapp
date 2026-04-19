import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { Text } from '@/lib/ui/primitives/Text'
import { TEXT_STYLES } from '@/lib/ui/tokens'
import { darkTheme } from '@/lib/shared/theme'

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...flattenStyle(s) }), {})
  }
  if (style && typeof style === 'object') return style as Record<string, unknown>
  return {}
}

describe('Text primitive', () => {
  it('renders children', () => {
    render(<Text>hello</Text>)
    expect(screen.getByText('hello')).toBeTruthy()
  })

  it('defaults to body variant + primary tone', () => {
    render(<Text testID="t">hi</Text>)
    const s = flattenStyle(screen.getByTestId('t').props.style)
    expect(s.fontSize).toBe(TEXT_STYLES.body.fontSize)
    expect(s.fontFamily).toBe(TEXT_STYLES.body.fontFamily)
    expect(s.color).toBe(darkTheme.text.primary)
  })

  it('applies the requested variant', () => {
    render(<Text testID="t" variant="display">hi</Text>)
    const s = flattenStyle(screen.getByTestId('t').props.style)
    expect(s.fontSize).toBe(TEXT_STYLES.display.fontSize)
    expect(s.letterSpacing).toBe(TEXT_STYLES.display.letterSpacing)
  })

  it('maps tone to theme colors', () => {
    render(<Text testID="t" tone="tertiary">hi</Text>)
    const s = flattenStyle(screen.getByTestId('t').props.style)
    expect(s.color).toBe(darkTheme.text.tertiary)
  })

  it('accent tone uses semantic.primary.color', () => {
    render(<Text testID="t" tone="accent">hi</Text>)
    const s = flattenStyle(screen.getByTestId('t').props.style)
    expect(s.color).toBe(darkTheme.semantic.primary.color)
  })
})
