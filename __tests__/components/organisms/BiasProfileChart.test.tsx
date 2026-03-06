/**
 * Tests for components/organisms/BiasProfileChart.tsx
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BiasProfileChart } from '@/components/organisms/BiasProfileChart'
import type { BiasProfile } from '@/lib/api/bias-calculator'

const mockProfile: BiasProfile = {
  userDistribution: [
    { bias: 'far-left', percentage: 5 },
    { bias: 'left', percentage: 30 },
    { bias: 'lean-left', percentage: 15 },
    { bias: 'center', percentage: 20 },
    { bias: 'lean-right', percentage: 15 },
    { bias: 'right', percentage: 10 },
    { bias: 'far-right', percentage: 5 },
  ],
  overallDistribution: [
    { bias: 'far-left', percentage: 10 },
    { bias: 'left', percentage: 20 },
    { bias: 'lean-left', percentage: 15 },
    { bias: 'center', percentage: 20 },
    { bias: 'lean-right', percentage: 15 },
    { bias: 'right', percentage: 15 },
    { bias: 'far-right', percentage: 5 },
  ],
  blindspots: ['far-left'],
  totalStoriesRead: 25,
  dominantBias: 'left',
}

describe('BiasProfileChart', () => {
  it('renders bias labels', () => {
    render(<BiasProfileChart profile={mockProfile} />)

    expect(screen.getByText('Far Left (blindspot)')).toBeInTheDocument()
    expect(screen.getByText('Left')).toBeInTheDocument()
    expect(screen.getByText('Center')).toBeInTheDocument()
    expect(screen.getByText('Right')).toBeInTheDocument()
  })

  it('shows dominant bias', () => {
    render(<BiasProfileChart profile={mockProfile} />)

    expect(screen.getByText('Dominant: Left')).toBeInTheDocument()
  })

  it('shows percentage values', () => {
    render(<BiasProfileChart profile={mockProfile} />)

    expect(screen.getByText('30% / 20%')).toBeInTheDocument()
  })

  it('renders legend items', () => {
    render(<BiasProfileChart profile={mockProfile} />)

    expect(screen.getByText('Your reading')).toBeInTheDocument()
    expect(screen.getByText('All stories')).toBeInTheDocument()
  })

  it('renders without dominant bias', () => {
    const noDominant: BiasProfile = {
      ...mockProfile,
      dominantBias: null,
    }
    render(<BiasProfileChart profile={noDominant} />)

    expect(screen.queryByText(/Dominant:/)).not.toBeInTheDocument()
  })
})
