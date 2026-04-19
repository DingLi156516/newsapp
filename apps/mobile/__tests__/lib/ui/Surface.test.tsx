import React from 'react'
import { Text } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { Surface } from '@/lib/ui/primitives/Surface'
import { darkTheme } from '@/lib/shared/theme'

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...flattenStyle(s) }), {})
  }
  if (style && typeof style === 'object') return style as Record<string, unknown>
  return {}
}

describe('Surface primitive', () => {
  it('renders children', () => {
    render(
      <Surface>
        <Text>inside</Text>
      </Surface>,
    )
    expect(screen.getByText('inside')).toBeTruthy()
  })

  it('applies accent left-border when provided', () => {
    render(
      <Surface testID="surf" accent="#ff0000">
        <Text>x</Text>
      </Surface>,
    )
    const s = flattenStyle(screen.getByTestId('surf').props.style)
    expect(s.borderLeftColor).toBe('#ff0000')
    expect(s.borderLeftWidth).toBe(3)
  })

  it('solid variant uses theme.surface.background', () => {
    render(
      <Surface testID="surf" variant="solid">
        <Text>x</Text>
      </Surface>,
    )
    const s = flattenStyle(screen.getByTestId('surf').props.style)
    expect(s.backgroundColor).toBe(darkTheme.surface.background)
  })
})
