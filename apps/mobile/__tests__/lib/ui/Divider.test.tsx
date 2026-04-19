import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { Divider } from '@/lib/ui/primitives/Divider'

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...flattenStyle(s) }), {})
  }
  if (style && typeof style === 'object') return style as Record<string, unknown>
  return {}
}

describe('Divider primitive', () => {
  it('defaults to a horizontal 1px rule', () => {
    render(<Divider testID="d" />)
    const s = flattenStyle(screen.getByTestId('d').props.style)
    expect(s.height).toBe(1)
    expect(s.width).toBeUndefined()
  })

  it('vertical orientation produces a 1px column', () => {
    render(<Divider testID="d" orientation="vertical" />)
    const s = flattenStyle(screen.getByTestId('d').props.style)
    expect(s.width).toBe(1)
    expect(s.height).toBeUndefined()
  })
})
