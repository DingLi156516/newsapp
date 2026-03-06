import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MonochromeSpectrumBar } from '@/components/molecules/MonochromeSpectrumBar'
import type { SpectrumSegment } from '@/lib/types'

vi.mock('framer-motion')

const segments: SpectrumSegment[] = [
  { bias: 'left', percentage: 30 },
  { bias: 'center', percentage: 40 },
  { bias: 'right', percentage: 30 },
]

const segmentsWithZero: SpectrumSegment[] = [
  { bias: 'left', percentage: 50 },
  { bias: 'center', percentage: 0 },
  { bias: 'right', percentage: 50 },
]

const labelSegments: SpectrumSegment[] = [
  { bias: 'far-left', percentage: 10 },
  { bias: 'left', percentage: 20 },
  { bias: 'lean-left', percentage: 10 },
  { bias: 'center', percentage: 20 },
  { bias: 'lean-right', percentage: 15 },
  { bias: 'right', percentage: 15 },
  { bias: 'far-right', percentage: 10 },
]

describe('MonochromeSpectrumBar', () => {
  it('renders the correct number of non-zero segments', () => {
    render(<MonochromeSpectrumBar segments={segments} />)
    const bar = screen.getByRole('img', { name: 'Source bias distribution' })
    expect(bar.children).toHaveLength(3)
  })

  it('zero-percentage segments are not rendered', () => {
    render(<MonochromeSpectrumBar segments={segmentsWithZero} />)
    const bar = screen.getByRole('img', { name: 'Source bias distribution' })
    expect(bar.children).toHaveLength(2)
  })

  it('showLegend=false (default): no info button', () => {
    render(<MonochromeSpectrumBar segments={segments} />)
    expect(
      screen.queryByRole('button', { name: 'Show bias pattern legend' }),
    ).not.toBeInTheDocument()
  })

  it('showLegend=true: info button renders', () => {
    render(<MonochromeSpectrumBar segments={segments} showLegend />)
    expect(
      screen.getByRole('button', { name: 'Show bias pattern legend' }),
    ).toBeInTheDocument()
  })

  it('showLegend=true: clicking info button opens the legend', async () => {
    const user = userEvent.setup()
    render(<MonochromeSpectrumBar segments={segments} showLegend />)
    const infoBtn = screen.getByRole('button', { name: 'Show bias pattern legend' })
    await user.click(infoBtn)
    expect(screen.getByRole('dialog', { name: 'Bias pattern legend' })).toBeInTheDocument()
  })

  it('showLegend=true: legend is hidden by default', () => {
    render(<MonochromeSpectrumBar segments={segments} showLegend />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders a spectrum-track wrapper around the bar', () => {
    render(<MonochromeSpectrumBar segments={segments} />)
    const bar = screen.getByRole('img', { name: 'Source bias distribution' })
    expect(bar.parentElement).toHaveClass('spectrum-track')
  })

  it('showLabels=true: renders left and right percentage labels', () => {
    render(<MonochromeSpectrumBar segments={labelSegments} showLabels />)
    const labels = screen.getAllByText('40%')
    expect(labels).toHaveLength(2)
  })

  it('showLabels=false (default): no percentage labels', () => {
    render(<MonochromeSpectrumBar segments={segments} />)
    expect(screen.queryByText('30%')).not.toBeInTheDocument()
  })
})
