import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { Pill } from '@/lib/ui/primitives/Pill'

jest.mock('lucide-react-native', () => {
  const RN = require('react-native')
  const R = require('react')
  return {
    X: (props: Record<string, unknown>) =>
      R.createElement(RN.View, { testID: 'pill-x-icon', ...props }),
  }
})

describe('Pill primitive', () => {
  it('renders the label', () => {
    render(<Pill label="A–Z" />)
    expect(screen.getByText('A–Z')).toBeTruthy()
  })

  it('invokes onPress when pressed', () => {
    const onPress = jest.fn()
    render(<Pill testID="pill" label="Bias" onPress={onPress} />)
    fireEvent.press(screen.getByTestId('pill'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('sets aria-selected when active', () => {
    render(<Pill testID="pill" label="Bias" active onPress={jest.fn()} />)
    const node = screen.getByTestId('pill')
    expect(node.props.accessibilityState?.selected).toBe(true)
  })

  it('renders dismiss glyph when dismissible', () => {
    render(<Pill label="Politics" dismissible onPress={jest.fn()} />)
    expect(screen.getByTestId('pill-x-icon')).toBeTruthy()
  })

  it('omits dismiss glyph by default', () => {
    render(<Pill label="Politics" onPress={jest.fn()} />)
    expect(screen.queryByTestId('pill-x-icon')).toBeNull()
  })

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn()
    render(<Pill testID="pill" label="Bias" onPress={onPress} disabled />)
    fireEvent.press(screen.getByTestId('pill'))
    expect(onPress).not.toHaveBeenCalled()
  })
})
