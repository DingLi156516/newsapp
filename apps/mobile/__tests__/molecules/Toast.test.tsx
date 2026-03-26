import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { Toast } from '@/components/molecules/Toast'
import type { ToastData } from '@/lib/hooks/use-toast'

jest.mock('lucide-react-native', () => {
  const RN = require('react-native')
  const R = require('react')
  return {
    CheckCircle: (props: Record<string, unknown>) => R.createElement(RN.View, { testID: 'icon-success', ...props }),
    Info: (props: Record<string, unknown>) => R.createElement(RN.View, { testID: 'icon-info', ...props }),
    AlertTriangle: (props: Record<string, unknown>) => R.createElement(RN.View, { testID: 'icon-warning', ...props }),
    XCircle: (props: Record<string, unknown>) => R.createElement(RN.View, { testID: 'icon-error', ...props }),
  }
})

const baseToast: ToastData = {
  id: 'test-1',
  message: 'Story saved',
  variant: 'success',
}

describe('Toast', () => {
  it('renders message text', () => {
    render(<Toast toast={baseToast} onDismiss={jest.fn()} />)
    expect(screen.getByText('Story saved')).toBeTruthy()
  })

  it.each(['success', 'info', 'warning', 'error'] as const)(
    'renders correct icon for variant "%s"',
    (variant) => {
      const toast = { ...baseToast, variant }
      render(<Toast toast={toast} onDismiss={jest.fn()} />)
      expect(screen.getByTestId(`toast-icon-${variant}`)).toBeTruthy()
    }
  )

  it('renders undo button when onUndo is provided', () => {
    const toast = { ...baseToast, onUndo: jest.fn() }
    render(<Toast toast={toast} onDismiss={jest.fn()} />)
    expect(screen.getByText('Undo')).toBeTruthy()
  })

  it('does not render undo when onUndo is undefined', () => {
    render(<Toast toast={baseToast} onDismiss={jest.fn()} />)
    expect(screen.queryByText('Undo')).toBeNull()
  })

  it('calls onUndo and onDismiss when undo is pressed', () => {
    const onUndo = jest.fn()
    const onDismiss = jest.fn()
    const toast = { ...baseToast, onUndo }
    render(<Toast toast={toast} onDismiss={onDismiss} />)

    fireEvent.press(screen.getByTestId('toast-undo'))
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders action button when onAction and actionLabel are provided', () => {
    const toast = { ...baseToast, onAction: jest.fn(), actionLabel: 'Sign in' }
    render(<Toast toast={toast} onDismiss={jest.fn()} />)
    expect(screen.getByText('Sign in')).toBeTruthy()
  })

  it('calls onAction and onDismiss when action button is pressed', () => {
    const onAction = jest.fn()
    const onDismiss = jest.fn()
    const toast = { ...baseToast, onAction, actionLabel: 'Sign in' }
    render(<Toast toast={toast} onDismiss={onDismiss} />)

    fireEvent.press(screen.getByTestId('toast-action'))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('has accessibility label matching message', () => {
    render(<Toast toast={baseToast} onDismiss={jest.fn()} />)
    expect(screen.getByLabelText('Story saved')).toBeTruthy()
  })
})
