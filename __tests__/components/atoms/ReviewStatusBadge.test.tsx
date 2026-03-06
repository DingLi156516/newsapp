import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReviewStatusBadge } from '@/components/atoms/ReviewStatusBadge'

describe('ReviewStatusBadge', () => {
  it('renders pending badge with amber styling', () => {
    render(<ReviewStatusBadge status="pending" />)
    const badge = screen.getByText('Pending')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('amber')
  })

  it('renders approved badge with green styling', () => {
    render(<ReviewStatusBadge status="approved" />)
    const badge = screen.getByText('Approved')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('green')
  })

  it('renders rejected badge with red styling', () => {
    render(<ReviewStatusBadge status="rejected" />)
    const badge = screen.getByText('Rejected')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('red')
  })

  it('renders editing badge with blue styling', () => {
    render(<ReviewStatusBadge status="editing" />)
    const badge = screen.getByText('Editing')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('blue')
  })

  it('has glass-pill class', () => {
    render(<ReviewStatusBadge status="pending" />)
    const badge = screen.getByText('Pending')
    expect(badge.className).toContain('glass-pill')
  })
})
