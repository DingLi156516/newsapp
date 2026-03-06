import { render, screen } from '@testing-library/react'
import { FactualityDots } from '@/components/atoms/FactualityDots'
import { FACTUALITY_LABELS } from '@/lib/types'

describe('FactualityDots', () => {
  it('renders exactly 5 dots for every factuality level', () => {
    const levels = ['very-high', 'high', 'mixed', 'low', 'very-low'] as const
    levels.forEach((level) => {
      const { container, unmount } = render(<FactualityDots level={level} />)
      const dots = container.querySelectorAll('span.inline-block')
      expect(dots).toHaveLength(5)
      unmount()
    })
  })

  it('very-high: all 5 dots are filled (bg-white/80 class)', () => {
    const { container } = render(<FactualityDots level="very-high" />)
    const dots = container.querySelectorAll('span.inline-block')
    expect(dots).toHaveLength(5)
    dots.forEach((dot) => {
      expect(dot.className).toContain('bg-white/80')
    })
  })

  it('low: 2 dots filled, 3 empty (have border class)', () => {
    const { container } = render(<FactualityDots level="low" />)
    const dots = Array.from(container.querySelectorAll('span.inline-block'))
    const filled = dots.filter((d) => d.className.includes('bg-white/80'))
    const empty = dots.filter((d) => d.className.includes('bg-transparent'))
    expect(filled).toHaveLength(2)
    expect(empty).toHaveLength(3)
  })

  it('very-low: 1 dot filled, 4 empty', () => {
    const { container } = render(<FactualityDots level="very-low" />)
    const dots = Array.from(container.querySelectorAll('span.inline-block'))
    const filled = dots.filter((d) => d.className.includes('bg-white/80'))
    expect(filled).toHaveLength(1)
  })

  it('has aria-label containing the factuality level string', () => {
    render(<FactualityDots level="high" />)
    const el = screen.getByLabelText(/Factuality: High Factuality/i)
    expect(el).toBeInTheDocument()
  })

  it('showLabel=false (default): does not render label text', () => {
    render(<FactualityDots level="very-high" />)
    expect(screen.queryByText(FACTUALITY_LABELS['very-high'])).not.toBeInTheDocument()
  })

  it('showLabel=true: renders the FACTUALITY_LABELS text', () => {
    render(<FactualityDots level="mixed" showLabel />)
    expect(screen.getByText(FACTUALITY_LABELS['mixed'])).toBeInTheDocument()
  })
})
