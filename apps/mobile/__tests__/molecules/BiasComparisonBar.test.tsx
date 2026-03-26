import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { BiasComparisonBar } from '@/components/molecules/BiasComparisonBar'
import type { BiasCategory } from '@/lib/shared/types'

const userDist = [
  { bias: 'left' as BiasCategory, percentage: 40 },
  { bias: 'center' as BiasCategory, percentage: 35 },
  { bias: 'right' as BiasCategory, percentage: 25 },
]

const overallDist = [
  { bias: 'left' as BiasCategory, percentage: 30 },
  { bias: 'center' as BiasCategory, percentage: 40 },
  { bias: 'right' as BiasCategory, percentage: 30 },
]

describe('BiasComparisonBar', () => {
  it('renders "Your Reading" and "All Stories" labels', () => {
    render(<BiasComparisonBar userDistribution={userDist} overallDistribution={overallDist} />)
    expect(screen.getByText('Your Reading')).toBeTruthy()
    expect(screen.getByText('All Stories')).toBeTruthy()
  })

  it('renders spectrum labels', () => {
    render(<BiasComparisonBar userDistribution={userDist} overallDistribution={overallDist} />)
    expect(screen.getByText('Far Left')).toBeTruthy()
    expect(screen.getByText('Center')).toBeTruthy()
    expect(screen.getByText('Far Right')).toBeTruthy()
  })

  it('renders without crashing with empty distributions', () => {
    render(<BiasComparisonBar userDistribution={[]} overallDistribution={[]} />)
    expect(screen.getByText('Your Reading')).toBeTruthy()
  })
})
