import { render, screen } from '@testing-library/react'
import { CoverageCount } from '@/components/atoms/CoverageCount'

describe('CoverageCount', () => {
  it('renders "{count} sources" text for count=43', () => {
    render(<CoverageCount count={43} />)
    expect(screen.getByText('43 sources')).toBeInTheDocument()
  })

  it('renders "1 sources" for count=1 (edge case)', () => {
    render(<CoverageCount count={1} />)
    expect(screen.getByText('1 sources')).toBeInTheDocument()
  })

  it('renders "0 sources" for count=0', () => {
    render(<CoverageCount count={0} />)
    expect(screen.getByText('0 sources')).toBeInTheDocument()
  })

  it('renders large numbers correctly', () => {
    render(<CoverageCount count={1000} />)
    expect(screen.getByText('1000 sources')).toBeInTheDocument()
  })
})
