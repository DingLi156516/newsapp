/**
 * Tests for components/molecules/BiasComparisonBar.tsx
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BiasComparisonBar } from '@/components/molecules/BiasComparisonBar'
import type { BiasDistribution } from '@/lib/api/bias-calculator'

const userDistribution: BiasDistribution[] = [
  { bias: 'far-left', percentage: 0 },
  { bias: 'left', percentage: 40 },
  { bias: 'lean-left', percentage: 10 },
  { bias: 'center', percentage: 30 },
  { bias: 'lean-right', percentage: 10 },
  { bias: 'right', percentage: 10 },
  { bias: 'far-right', percentage: 0 },
]

const overallDistribution: BiasDistribution[] = [
  { bias: 'far-left', percentage: 5 },
  { bias: 'left', percentage: 20 },
  { bias: 'lean-left', percentage: 15 },
  { bias: 'center', percentage: 25 },
  { bias: 'lean-right', percentage: 15 },
  { bias: 'right', percentage: 15 },
  { bias: 'far-right', percentage: 5 },
]

describe('BiasComparisonBar', () => {
  it('renders "Your Reading" and "All Stories" labels', () => {
    render(
      <BiasComparisonBar
        userDistribution={userDistribution}
        overallDistribution={overallDistribution}
      />
    )
    expect(screen.getByText('Your Reading')).toBeInTheDocument()
    expect(screen.getByText('All Stories')).toBeInTheDocument()
  })

  it('renders spectrum bars for both distributions', () => {
    render(
      <BiasComparisonBar
        userDistribution={userDistribution}
        overallDistribution={overallDistribution}
      />
    )
    const bars = screen.getAllByRole('img')
    expect(bars).toHaveLength(2)
  })

  it('shows axis labels', () => {
    render(
      <BiasComparisonBar
        userDistribution={userDistribution}
        overallDistribution={overallDistribution}
      />
    )
    expect(screen.getByText('Far Left')).toBeInTheDocument()
    expect(screen.getByText('Center')).toBeInTheDocument()
    expect(screen.getByText('Far Right')).toBeInTheDocument()
  })

  it('has accessibility attributes on spectrum bars', () => {
    render(
      <BiasComparisonBar
        userDistribution={userDistribution}
        overallDistribution={overallDistribution}
      />
    )
    expect(screen.getByLabelText('Your Reading bias distribution')).toBeInTheDocument()
    expect(screen.getByLabelText('All Stories bias distribution')).toBeInTheDocument()
  })

  it('applies correct spectrum CSS classes via title attributes', () => {
    const { container } = render(
      <BiasComparisonBar
        userDistribution={userDistribution}
        overallDistribution={overallDistribution}
      />
    )
    expect(container.querySelector('.spectrum-left')).toBeInTheDocument()
    expect(container.querySelector('.spectrum-center')).toBeInTheDocument()
    expect(container.querySelector('.spectrum-right')).toBeInTheDocument()
  })
})
