import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { OfflineIndicator } from '@/components/atoms/OfflineIndicator'

jest.mock('lucide-react-native', () => {
  const RN = require('react-native')
  const R = require('react')
  return {
    WifiOff: (props: Record<string, unknown>) =>
      R.createElement(RN.View, { testID: 'wifi-off-icon', ...props }),
  }
})

const mockUseOnline = jest.fn<boolean, []>()
jest.mock('@/lib/hooks/use-online', () => ({
  useOnline: () => mockUseOnline(),
}))

describe('OfflineIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null when online', () => {
    mockUseOnline.mockReturnValue(true)
    const { toJSON } = render(<OfflineIndicator />)
    expect(toJSON()).toBeNull()
  })

  it('renders "Offline" text when offline', () => {
    mockUseOnline.mockReturnValue(false)
    render(<OfflineIndicator />)
    expect(screen.getByText('Offline')).toBeTruthy()
  })

  it('renders WifiOff icon when offline', () => {
    mockUseOnline.mockReturnValue(false)
    render(<OfflineIndicator />)
    expect(screen.getByTestId('wifi-off-icon')).toBeTruthy()
  })
})
