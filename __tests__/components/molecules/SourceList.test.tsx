import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SourceList } from '@/components/molecules/SourceList'
import type { NewsSource } from '@/lib/types'

vi.mock('framer-motion')

function makeSources(n: number): NewsSource[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `src-${i}`,
    name: `Source ${i}`,
    bias: 'center' as const,
    factuality: 'high' as const,
    ownership: 'corporate' as const,
    url: `source${i}.com`,
  }))
}

describe('SourceList', () => {
  it('shows "Sources (N)" header text', () => {
    const sources = makeSources(3)
    render(<SourceList sources={sources} />)
    expect(screen.getByText('Sources (3)')).toBeInTheDocument()
  })

  it('defaultExpanded=false: source rows are hidden', () => {
    const sources = makeSources(2)
    render(<SourceList sources={sources} />)
    expect(screen.queryByText('Source 0')).not.toBeInTheDocument()
    expect(screen.queryByText('Source 1')).not.toBeInTheDocument()
  })

  it('defaultExpanded=true: source rows are visible', () => {
    const sources = makeSources(2)
    render(<SourceList sources={sources} defaultExpanded />)
    expect(screen.getByText('Source 0')).toBeInTheDocument()
    expect(screen.getByText('Source 1')).toBeInTheDocument()
  })

  it('clicking header toggles expanded state and reveals source rows', async () => {
    const sources = makeSources(1)
    const user = userEvent.setup()
    render(<SourceList sources={sources} />)
    expect(screen.queryByText('Source 0')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Source 0')).toBeInTheDocument()
  })

  it('clicking header twice collapses source rows again', async () => {
    const sources = makeSources(1)
    const user = userEvent.setup()
    render(<SourceList sources={sources} />)
    const btn = screen.getByRole('button')
    await user.click(btn)
    expect(screen.getByText('Source 0')).toBeInTheDocument()
    await user.click(btn)
    expect(screen.queryByText('Source 0')).not.toBeInTheDocument()
  })

  it('with 8 sources and maxVisible=5: shows "Show 3 more sources" button', async () => {
    const sources = makeSources(8)
    const user = userEvent.setup()
    render(<SourceList sources={sources} maxVisible={5} defaultExpanded />)
    expect(screen.getByText('Show 3 more sources')).toBeInTheDocument()
    expect(screen.getByText('Source 0')).toBeInTheDocument()
    expect(screen.queryByText('Source 5')).not.toBeInTheDocument()
  })

  it('"Show more" button reveals all sources', async () => {
    const sources = makeSources(8)
    const user = userEvent.setup()
    render(<SourceList sources={sources} maxVisible={5} defaultExpanded />)
    await user.click(screen.getByText('Show 3 more sources'))
    expect(screen.getByText('Source 5')).toBeInTheDocument()
    expect(screen.getByText('Source 7')).toBeInTheDocument()
  })
})
