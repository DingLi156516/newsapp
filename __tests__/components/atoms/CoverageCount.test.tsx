import { render, screen } from '@testing-library/react'
import { CoverageCount } from '@/components/atoms/CoverageCount'

describe('CoverageCount', () => {
  it('renders "{count} sources" text for count=43', () => {
    render(<CoverageCount count={43} />)
    expect(screen.getByText('43 sources')).toBeInTheDocument()
  })

  it('renders "Single Source" for count=1', () => {
    render(<CoverageCount count={1} />)
    expect(screen.getByText('Single Source')).toBeInTheDocument()
  })

  it('applies amber styling for single-source stories', () => {
    const { container, rerender } = render(<CoverageCount count={1} />)
    const pill = container.firstElementChild as HTMLElement
    expect(pill.className).toContain('text-amber-300/90')
    expect(pill.className).toContain('ring-amber-400/20')

    rerender(<CoverageCount count={3} />)
    const pillMulti = container.firstElementChild as HTMLElement
    expect(pillMulti.className).toContain('text-white/80')
    expect(pillMulti.className).not.toContain('text-amber-300/90')
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
