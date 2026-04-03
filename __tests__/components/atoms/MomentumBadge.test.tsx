import { render, screen } from '@testing-library/react'
import { MomentumBadge } from '@/components/atoms/MomentumBadge'

describe('MomentumBadge', () => {
  it('renders BREAKING label for breaking phase', () => {
    render(<MomentumBadge phase="breaking" />)
    expect(screen.getByText('BREAKING')).toBeInTheDocument()
  })

  it('renders DEVELOPING label for developing phase', () => {
    render(<MomentumBadge phase="developing" />)
    expect(screen.getByText('DEVELOPING')).toBeInTheDocument()
  })

  it('renders ANALYSIS label for analysis phase', () => {
    render(<MomentumBadge phase="analysis" />)
    expect(screen.getByText('ANALYSIS')).toBeInTheDocument()
  })

  it('renders AFTERMATH label for aftermath phase', () => {
    render(<MomentumBadge phase="aftermath" />)
    expect(screen.getByText('AFTERMATH')).toBeInTheDocument()
  })

  it('has appropriate aria-label', () => {
    render(<MomentumBadge phase="breaking" />)
    expect(screen.getByLabelText('Story phase: BREAKING')).toBeInTheDocument()
  })
})
