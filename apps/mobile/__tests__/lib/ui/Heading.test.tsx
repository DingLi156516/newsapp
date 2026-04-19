import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { Heading } from '@/lib/ui/primitives/Heading'
import { TEXT_STYLES } from '@/lib/ui/tokens'

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...flattenStyle(s) }), {})
  }
  if (style && typeof style === 'object') return style as Record<string, unknown>
  return {}
}

describe('Heading primitive', () => {
  it.each(['hero', 'display', 'title'] as const)(
    'applies the %s display variant',
    (variant) => {
      render(<Heading testID="h" variant={variant}>Title</Heading>)
      const s = flattenStyle(screen.getByTestId('h').props.style)
      expect(s.fontSize).toBe(TEXT_STYLES[variant].fontSize)
      expect(s.fontFamily).toBe(TEXT_STYLES[variant].fontFamily)
    },
  )

  it('renders the children', () => {
    render(<Heading variant="display">Axiom</Heading>)
    expect(screen.getByText('Axiom')).toBeTruthy()
  })
})
