import { render, screen } from '@testing-library/react'
import { MetricsRow } from '@/components/molecules/MetricsRow'

describe('MetricsRow', () => {
  it('renders impact score as a 0-100 chip', () => {
    render(<MetricsRow impactScore={78} articles24h={12} sourceDiversity={4} />)
    expect(screen.getByTestId('metrics-impact')).toHaveTextContent('78')
  })

  it('renders 24h article count', () => {
    render(<MetricsRow impactScore={78} articles24h={12} sourceDiversity={4} />)
    expect(screen.getByTestId('metrics-velocity')).toHaveTextContent('12')
  })

  it('renders source diversity count', () => {
    render(<MetricsRow impactScore={78} articles24h={12} sourceDiversity={4} />)
    expect(screen.getByTestId('metrics-diversity')).toHaveTextContent('4')
  })

  it('omits metrics when values are null/undefined', () => {
    render(<MetricsRow impactScore={null} articles24h={null} sourceDiversity={null} />)
    expect(screen.queryByTestId('metrics-impact')).not.toBeInTheDocument()
    expect(screen.queryByTestId('metrics-velocity')).not.toBeInTheDocument()
    expect(screen.queryByTestId('metrics-diversity')).not.toBeInTheDocument()
  })

  it('returns null when every metric is absent', () => {
    const { container } = render(
      <MetricsRow impactScore={null} articles24h={null} sourceDiversity={null} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('clamps impact to a 0-100 integer display', () => {
    render(<MetricsRow impactScore={42.7} articles24h={null} sourceDiversity={null} />)
    expect(screen.getByTestId('metrics-impact')).toHaveTextContent('43')
  })

  it('exposes an accessible label for screen readers', () => {
    render(<MetricsRow impactScore={50} articles24h={6} sourceDiversity={2} />)
    expect(screen.getByTestId('metrics-impact')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('50')
    )
  })
})
