import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { BiasDistributionList } from '@/components/molecules/BiasDistributionList'

describe('BiasDistributionList', () => {
  const userDistribution = [
    { bias: 'left' as const, percentage: 60 },
    { bias: 'center' as const, percentage: 30 },
    { bias: 'right' as const, percentage: 10 },
  ]
  const overallDistribution = [
    { bias: 'left' as const, percentage: 33 },
    { bias: 'center' as const, percentage: 34 },
    { bias: 'right' as const, percentage: 33 },
  ]

  it('renders one bias label + bar per user distribution entry', () => {
    render(
      <BiasDistributionList
        userDistribution={userDistribution}
        overallDistribution={overallDistribution}
        blindspots={[]}
      />,
    )
    expect(screen.getByText('Left')).toBeTruthy()
    expect(screen.getByText('Center')).toBeTruthy()
    expect(screen.getByText('Right')).toBeTruthy()
    expect(screen.getByText('60% / 33%')).toBeTruthy()
  })

  it('annotates blindspot biases with "(blindspot)"', () => {
    render(
      <BiasDistributionList
        userDistribution={userDistribution}
        overallDistribution={overallDistribution}
        blindspots={['right']}
      />,
    )
    expect(screen.getByText('Right (blindspot)')).toBeTruthy()
  })

  it('renders legend with user + overall markers', () => {
    render(
      <BiasDistributionList
        userDistribution={userDistribution}
        overallDistribution={overallDistribution}
        blindspots={[]}
      />,
    )
    expect(screen.getByText('Your reading')).toBeTruthy()
    expect(screen.getByText('All stories')).toBeTruthy()
  })
})
