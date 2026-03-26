import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { GuideLink } from '@/components/atoms/GuideLink'

describe('GuideLink', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders with accessibility label', () => {
    render(<GuideLink />)
    expect(screen.getByLabelText('Learn more')).toBeTruthy()
  })

  it('pressing navigates to /guide', () => {
    render(<GuideLink />)
    fireEvent.press(screen.getByLabelText('Learn more'))
    expect(mockPush).toHaveBeenCalledWith('/guide')
  })
})
