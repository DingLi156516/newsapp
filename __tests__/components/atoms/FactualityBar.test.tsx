import { render, screen } from '@testing-library/react'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { FACTUALITY, FACTUALITY_LABELS } from '@/lib/types'
import type { FactualityLevel } from '@/lib/types'

const ALL_LEVELS: FactualityLevel[] = ['very-high', 'high', 'mixed', 'low', 'very-low']

describe('FactualityBar', () => {
  it.each(ALL_LEVELS)('renders with aria-label for level "%s"', (level) => {
    render(<FactualityBar level={level} />)
    expect(screen.getByLabelText(`Factuality: ${FACTUALITY_LABELS[level]}`)).toBeInTheDocument()
  })

  it.each(ALL_LEVELS)('fill bar width matches FACTUALITY token for level "%s"', (level) => {
    const { container } = render(<FactualityBar level={level} />)
    const track = container.querySelector('[class*="relative"]') as HTMLElement
    const fill = track?.firstChild as HTMLElement
    expect(fill.style.width).toBe(`${FACTUALITY[level].fill * 100}%`)
    expect(fill.style.backgroundColor).toBeTruthy()
  })

  it('default size: track is 40x4', () => {
    const { container } = render(<FactualityBar level="high" />)
    const track = container.querySelector('[class*="relative"]') as HTMLElement
    expect(track.style.width).toBe('40px')
    expect(track.style.height).toBe('4px')
  })

  it('compact size: track is 28x3', () => {
    const { container } = render(<FactualityBar level="high" size="compact" />)
    const track = container.querySelector('[class*="relative"]') as HTMLElement
    expect(track.style.width).toBe('28px')
    expect(track.style.height).toBe('3px')
  })

  it('showLabel=false (default): does not render label text', () => {
    render(<FactualityBar level="very-high" />)
    expect(screen.queryByText(FACTUALITY_LABELS['very-high'])).not.toBeInTheDocument()
  })

  it('showLabel=true: renders the label in matching color', () => {
    render(<FactualityBar level="mixed" showLabel />)
    const label = screen.getByText(FACTUALITY_LABELS['mixed'])
    expect(label).toBeInTheDocument()
    expect(label.style.color).toBeTruthy()
  })
})
