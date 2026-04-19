import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { LogOut } from 'lucide-react-native'
import { Button } from '@/lib/ui/primitives/Button'

jest.mock('lucide-react-native', () => {
  const RN = require('react-native')
  const R = require('react')
  return {
    LogOut: (props: Record<string, unknown>) =>
      R.createElement(RN.View, { testID: 'btn-icon', ...props }),
  }
})

describe('Button primitive', () => {
  it('renders label children', () => {
    render(<Button onPress={jest.fn()}>Sign In</Button>)
    expect(screen.getByText('Sign In')).toBeTruthy()
  })

  it('calls onPress when pressed', () => {
    const onPress = jest.fn()
    render(
      <Button testID="btn" onPress={onPress}>
        Sign In
      </Button>,
    )
    fireEvent.press(screen.getByTestId('btn'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('renders leading icon when provided', () => {
    render(
      <Button onPress={jest.fn()} icon={LogOut}>
        Sign Out
      </Button>,
    )
    expect(screen.getByTestId('btn-icon')).toBeTruthy()
  })

  it('ignores press when disabled', () => {
    const onPress = jest.fn()
    render(
      <Button testID="btn" onPress={onPress} disabled>
        Sign In
      </Button>,
    )
    fireEvent.press(screen.getByTestId('btn'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('ignores press while loading', () => {
    const onPress = jest.fn()
    render(
      <Button testID="btn" onPress={onPress} loading>
        Submit
      </Button>,
    )
    fireEvent.press(screen.getByTestId('btn'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('hides label content when loading', () => {
    render(
      <Button onPress={jest.fn()} loading>
        Submit
      </Button>,
    )
    expect(screen.queryByText('Submit')).toBeNull()
  })
})
