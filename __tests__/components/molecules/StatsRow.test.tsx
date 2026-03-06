import { render, screen } from '@testing-library/react'
import { StatsRow } from '@/components/molecules/StatsRow'

describe('StatsRow', () => {
  const defaultProps = {
    stories: 142,
    sources: 487,
    blindspots: 8,
    saved: 3,
  }

  it('renders all 4 stat tiles with correct values', () => {
    render(<StatsRow {...defaultProps} />)
    expect(screen.getByText('142')).toBeInTheDocument()
    expect(screen.getByText('487')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders all 4 labels', () => {
    render(<StatsRow {...defaultProps} />)
    expect(screen.getByText('Stories')).toBeInTheDocument()
    expect(screen.getByText('Sources')).toBeInTheDocument()
    expect(screen.getByText('Blindspots')).toBeInTheDocument()
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('handles zero values', () => {
    render(<StatsRow stories={0} sources={0} blindspots={0} saved={0} />)
    const zeros = screen.getAllByText('0')
    expect(zeros).toHaveLength(4)
  })

  it('accepts and applies className', () => {
    const { container } = render(<StatsRow {...defaultProps} className="mt-4" />)
    expect(container.firstChild).toHaveClass('mt-4')
  })
})
