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
    region: 'us' as const,
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

  it('uses articleUrl when present', () => {
    const sources: NewsSource[] = [{
      id: 'src-0',
      name: 'Source 0',
      bias: 'center',
      factuality: 'high',
      ownership: 'corporate',
      region: 'us',
      url: 'source0.com',
      articleUrl: 'https://source0.com/article/123',
    }]
    render(<SourceList sources={sources} defaultExpanded />)
    const link = screen.getByLabelText('Read article on Source 0')
    expect(link).toHaveAttribute('href', 'https://source0.com/article/123')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('falls back to source URL when articleUrl not present', () => {
    const sources: NewsSource[] = [{
      id: 'src-0',
      name: 'Source 0',
      bias: 'center',
      factuality: 'high',
      ownership: 'corporate',
      region: 'us',
      url: 'source0.com',
    }]
    render(<SourceList sources={sources} defaultExpanded />)
    const link = screen.getByLabelText('Visit Source 0')
    expect(link).toHaveAttribute('href', 'https://source0.com')
  })

  it('has correct aria-label for article link', () => {
    const sources: NewsSource[] = [{
      id: 'src-0',
      name: 'Reuters',
      bias: 'center',
      factuality: 'high',
      ownership: 'corporate',
      region: 'international',
      url: 'reuters.com',
      articleUrl: 'https://reuters.com/article/xyz',
    }]
    render(<SourceList sources={sources} defaultExpanded />)
    expect(screen.getByLabelText('Read article on Reuters')).toBeInTheDocument()
  })
})
