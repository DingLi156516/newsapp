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

  describe('same-owner indicator', () => {
    it('shows "N from {owner}" when multiple sources share the same owner', () => {
      const owner = {
        id: 'owner-1',
        name: 'Fox Corporation',
        slug: 'fox-corporation',
        ownerType: 'public_company' as const,
        isIndividual: false,
        country: 'United States',
        wikidataQid: 'Q186068',
        ownerSource: 'wikidata' as const,
        ownerVerifiedAt: '2026-04-01T00:00:00Z',
      }
      const sources: NewsSource[] = [
        {
          id: 'src-0', name: 'Fox News', bias: 'right', factuality: 'mixed',
          ownership: 'corporate', region: 'us', url: 'foxnews.com', owner,
        },
        {
          id: 'src-1', name: 'Fox Business', bias: 'lean-right', factuality: 'high',
          ownership: 'corporate', region: 'us', url: 'foxbusiness.com', owner,
        },
      ]
      render(<SourceList sources={sources} defaultExpanded />)
      expect(screen.getByText(/2 from Fox Corporation/)).toBeInTheDocument()
    })

    it('does not show indicator when sources have different owners', () => {
      const sources: NewsSource[] = [
        {
          id: 'src-0', name: 'Fox News', bias: 'right', factuality: 'mixed',
          ownership: 'corporate', region: 'us',
          owner: {
            id: 'owner-1', name: 'Fox Corporation', slug: 'fox-corporation',
            ownerType: 'public_company', isIndividual: false, country: 'US',
            wikidataQid: null, ownerSource: 'wikidata', ownerVerifiedAt: '2026-04-01T00:00:00Z',
          },
        },
        {
          id: 'src-1', name: 'CNN', bias: 'left', factuality: 'mixed',
          ownership: 'corporate', region: 'us',
          owner: {
            id: 'owner-2', name: 'Warner Bros. Discovery', slug: 'warner-bros-discovery',
            ownerType: 'public_company', isIndividual: false, country: 'US',
            wikidataQid: null, ownerSource: 'wikidata', ownerVerifiedAt: '2026-04-01T00:00:00Z',
          },
        },
      ]
      render(<SourceList sources={sources} defaultExpanded />)
      expect(screen.queryByText(/from Fox Corporation/)).not.toBeInTheDocument()
      expect(screen.queryByText(/from Warner Bros/)).not.toBeInTheDocument()
    })

    it('renders normally when sources have no owner', () => {
      const sources: NewsSource[] = [
        {
          id: 'src-0', name: 'Source A', bias: 'center', factuality: 'high',
          ownership: 'independent', region: 'us',
        },
        {
          id: 'src-1', name: 'Source B', bias: 'center', factuality: 'high',
          ownership: 'independent', region: 'us',
        },
      ]
      render(<SourceList sources={sources} defaultExpanded />)
      expect(screen.getByText('Source A')).toBeInTheDocument()
      expect(screen.getByText('Source B')).toBeInTheDocument()
    })
  })
})
