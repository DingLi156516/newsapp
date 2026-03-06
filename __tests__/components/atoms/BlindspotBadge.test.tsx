import { render, screen } from '@testing-library/react'
import { BlindspotBadge } from '@/components/atoms/BlindspotBadge'

describe('BlindspotBadge', () => {
  it('renders the text "BLINDSPOT"', () => {
    render(<BlindspotBadge />)
    expect(screen.getByText('BLINDSPOT')).toBeInTheDocument()
  })

  it('has an aria-label describing what a blindspot is', () => {
    render(<BlindspotBadge />)
    const badge = screen.getByLabelText(/blindspot/i)
    expect(badge).toBeInTheDocument()
  })

  it('aria-label mentions coverage or political spectrum', () => {
    render(<BlindspotBadge />)
    const badge = screen.getByLabelText(/coverage|spectrum/i)
    expect(badge).toBeInTheDocument()
  })
})
