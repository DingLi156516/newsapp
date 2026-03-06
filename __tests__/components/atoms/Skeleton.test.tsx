import { render, screen } from '@testing-library/react'
import { Skeleton } from '@/components/atoms/Skeleton'

describe('Skeleton', () => {
  it('renders with default class', () => {
    render(<Skeleton />)
    const el = screen.getByRole('status')
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass('animate-pulse')
  })

  it('applies custom className', () => {
    render(<Skeleton className="h-10 w-full" />)
    const el = screen.getByRole('status')
    expect(el).toHaveClass('h-10', 'w-full')
  })

  it('has loading aria-label', () => {
    render(<Skeleton />)
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })
})
