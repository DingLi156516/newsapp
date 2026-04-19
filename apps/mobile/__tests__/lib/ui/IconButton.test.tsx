import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { Settings } from 'lucide-react-native'
import { IconButton } from '@/lib/ui/primitives/IconButton'

jest.mock('lucide-react-native', () => {
  const RN = require('react-native')
  const R = require('react')
  return {
    Settings: (props: Record<string, unknown>) =>
      R.createElement(RN.View, { testID: 'icon', ...props }),
  }
})

describe('IconButton primitive', () => {
  it('renders the icon', () => {
    render(
      <IconButton icon={Settings} onPress={jest.fn()} accessibilityLabel="Settings" />,
    )
    expect(screen.getByTestId('icon')).toBeTruthy()
  })

  it('calls onPress when pressed', () => {
    const onPress = jest.fn()
    render(
      <IconButton
        icon={Settings}
        onPress={onPress}
        testID="iconbtn"
        accessibilityLabel="Settings"
      />,
    )
    fireEvent.press(screen.getByTestId('iconbtn'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('renders numeric badge when provided', () => {
    render(
      <IconButton
        icon={Settings}
        onPress={jest.fn()}
        accessibilityLabel="Filters"
        badge={3}
      />,
    )
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('clamps the badge at 99+', () => {
    render(
      <IconButton
        icon={Settings}
        onPress={jest.fn()}
        accessibilityLabel="Filters"
        badge={120}
      />,
    )
    expect(screen.getByText('99+')).toBeTruthy()
  })

  it('does not render badge when count is 0', () => {
    render(
      <IconButton
        icon={Settings}
        onPress={jest.fn()}
        accessibilityLabel="Filters"
        badge={0}
      />,
    )
    expect(screen.queryByText('0')).toBeNull()
  })

  it('respects the accessibilityLabel prop', () => {
    render(
      <IconButton
        testID="iconbtn"
        icon={Settings}
        onPress={jest.fn()}
        accessibilityLabel="Open filters"
      />,
    )
    expect(screen.getByTestId('iconbtn').props.accessibilityLabel).toBe('Open filters')
  })
})
