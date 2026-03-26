import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
}))

import GuideScreen from '@/app/guide'

describe('GuideScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders Guide title', () => {
    render(<GuideScreen />)
    expect(screen.getByText('Guide')).toBeTruthy()
  })

  it('renders all 5 section headings', () => {
    render(<GuideScreen />)
    expect(screen.getByText('Bias Spectrum')).toBeTruthy()
    expect(screen.getByText('Factuality Ratings')).toBeTruthy()
    expect(screen.getByText('Blindspots')).toBeTruthy()
    expect(screen.getByText('Coverage & Sources')).toBeTruthy()
    expect(screen.getByText('Ownership Types')).toBeTruthy()
  })

  it('renders all 7 bias labels', () => {
    render(<GuideScreen />)
    expect(screen.getByText('Far Left')).toBeTruthy()
    expect(screen.getByText('Left')).toBeTruthy()
    expect(screen.getByText('Lean Left')).toBeTruthy()
    expect(screen.getByText('Center')).toBeTruthy()
    expect(screen.getByText('Lean Right')).toBeTruthy()
    expect(screen.getByText('Right')).toBeTruthy()
    expect(screen.getByText('Far Right')).toBeTruthy()
  })

  it('renders factuality levels with labels', () => {
    render(<GuideScreen />)
    expect(screen.getByText('Very High Factuality')).toBeTruthy()
    expect(screen.getByText('High Factuality')).toBeTruthy()
    expect(screen.getByText('Mixed Factuality')).toBeTruthy()
    expect(screen.getByText('Low Factuality')).toBeTruthy()
    expect(screen.getByText('Very Low Factuality')).toBeTruthy()
  })

  it('renders BlindspotBadge', () => {
    render(<GuideScreen />)
    expect(screen.getByText('Blindspot')).toBeTruthy()
  })

  it('renders CoverageCount', () => {
    render(<GuideScreen />)
    expect(screen.getByText('12 sources')).toBeTruthy()
  })

  it('renders all 8 ownership types', () => {
    render(<GuideScreen />)
    expect(screen.getByText('Independent')).toBeTruthy()
    expect(screen.getByText('Corporate')).toBeTruthy()
    expect(screen.getByText('Non-Profit')).toBeTruthy()
    expect(screen.getByText('State-Funded')).toBeTruthy()
    expect(screen.getByText('Private Equity')).toBeTruthy()
    expect(screen.getByText('Telecom')).toBeTruthy()
    expect(screen.getByText('Government')).toBeTruthy()
    expect(screen.getByText('Other')).toBeTruthy()
  })

  it('back button calls router.back()', () => {
    render(<GuideScreen />)
    fireEvent.press(screen.getByTestId('back-button'))
    expect(mockBack).toHaveBeenCalled()
  })
})
