import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Sparkline } from '@/components/atoms/Sparkline'

describe('Sparkline', () => {
  it('renders nothing for empty values', () => {
    const { container } = render(<Sparkline values={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders one rect per value', () => {
    const { container } = render(<Sparkline values={[1, 2, 3, 4]} />)
    const rects = container.querySelectorAll('rect')
    expect(rects).toHaveLength(4)
  })

  it('exposes title for accessibility', () => {
    render(<Sparkline values={[1]} title="trend" />)
    expect(screen.getByRole('img', { name: 'trend' })).toBeInTheDocument()
  })

  it('the tallest bar is at most the configured height', () => {
    const { container } = render(<Sparkline values={[10, 5, 1]} height={20} />)
    const rects = container.querySelectorAll('rect')
    const heights = Array.from(rects).map((r) => parseFloat(r.getAttribute('height') ?? '0'))
    expect(Math.max(...heights)).toBeLessThanOrEqual(20)
  })
})
