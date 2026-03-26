import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

import { NetworkErrorView } from '@/components/molecules/NetworkErrorView'

describe('NetworkErrorView', () => {
  it('renders the error message', () => {
    render(<NetworkErrorView onRetry={jest.fn()} />)
    expect(screen.getByText('Check your connection')).toBeTruthy()
  })

  it('renders a retry button', () => {
    render(<NetworkErrorView onRetry={jest.fn()} />)
    expect(screen.getByText('Try again')).toBeTruthy()
  })

  it('calls onRetry when retry button is pressed', () => {
    const onRetry = jest.fn()
    render(<NetworkErrorView onRetry={onRetry} />)
    fireEvent.press(screen.getByText('Try again'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
