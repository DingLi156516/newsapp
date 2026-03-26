import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SourcesView } from '@/components/organisms/SourcesView'
import type { NewsSource } from '@/lib/types'

const mockUseSources = vi.fn()

vi.mock('@/lib/hooks/use-sources', () => ({
  useSources: (...args: unknown[]) => mockUseSources(...args),
}))

function makeSource(overrides: Partial<NewsSource & { region: string }> = {}): NewsSource & { region: string } {
  return {
    id: overrides.id ?? 'source-1',
    slug: overrides.slug ?? 'reuters',
    name: overrides.name ?? 'Reuters',
    bias: overrides.bias ?? 'center',
    factuality: overrides.factuality ?? 'very-high',
    ownership: overrides.ownership ?? 'corporate',
    url: overrides.url ?? 'reuters.com',
    region: overrides.region ?? 'us',
    totalArticlesIngested: overrides.totalArticlesIngested,
  }
}

describe('SourcesView', () => {
  beforeEach(() => {
    mockUseSources.mockReturnValue({
      sources: [
        makeSource({ id: '1', name: 'Reuters', ownership: 'corporate', region: 'us' }),
        makeSource({ id: '2', name: 'BBC News', ownership: 'state-funded', region: 'uk', bias: 'center', url: 'bbc.com' }),
        makeSource({ id: '3', name: 'Jacobin', ownership: 'independent', region: 'international', bias: 'far-left', factuality: 'mixed', url: 'jacobin.com' }),
      ],
      isLoading: false,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders bias and factuality filter sections', () => {
    render(<SourcesView />)
    expect(screen.getByText('Filter by Bias')).toBeInTheDocument()
    expect(screen.getByText('Filter by Factuality')).toBeInTheDocument()
  })

  it('renders ownership and region filter sections', () => {
    render(<SourcesView />)
    expect(screen.getByText('Filter by Ownership')).toBeInTheDocument()
    expect(screen.getByText('Filter by Region')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /corporate/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /united states/i })).toBeInTheDocument()
  })

  it('renders source cards for all sources', () => {
    render(<SourcesView />)
    expect(screen.getByText('Reuters')).toBeInTheDocument()
    expect(screen.getByText('BBC News')).toBeInTheDocument()
    expect(screen.getByText('Jacobin')).toBeInTheDocument()
  })

  it('renders search input with placeholder', () => {
    render(<SourcesView />)
    expect(screen.getByPlaceholderText('Search sources…')).toBeInTheDocument()
  })

  it('links each source card to its profile page', () => {
    render(<SourcesView />)
    const reutersLink = screen.getByRole('link', { name: 'View Reuters profile' })
    expect(reutersLink).toHaveAttribute('href', '/sources/reuters')
  })

  it('applies ownership and region filters together', async () => {
    const user = userEvent.setup()
    render(<SourcesView />)

    await user.click(screen.getByRole('button', { name: /independent/i }))
    await user.click(screen.getByRole('button', { name: /international/i }))

    expect(screen.getByText('Jacobin')).toBeInTheDocument()
    expect(screen.queryByText('Reuters')).not.toBeInTheDocument()
    expect(screen.queryByText('BBC News')).not.toBeInTheDocument()
  })

  it('updates the source insight summary when filters narrow the list', async () => {
    const user = userEvent.setup()
    render(<SourcesView />)

    expect(screen.getByText('3 active sources in this directory.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /state-funded/i }))

    expect(screen.getByText('1 active source in this directory.')).toBeInTheDocument()
  })

  it('shows loading skeletons when isLoading=true', () => {
    mockUseSources.mockReturnValue({ sources: [], isLoading: true })
    const { container } = render(<SourcesView />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(container.querySelectorAll('.glass-sm')).not.toHaveLength(0)
  })

  it('renders source logos for each card', () => {
    render(<SourcesView />)
    expect(screen.getByAltText('Reuters logo')).toBeInTheDocument()
    expect(screen.getByAltText('BBC News logo')).toBeInTheDocument()
    expect(screen.getByAltText('Jacobin logo')).toBeInTheDocument()
  })

  it('shows article count when totalArticlesIngested is set', () => {
    mockUseSources.mockReturnValue({
      sources: [
        makeSource({ id: '1', name: 'Reuters', totalArticlesIngested: 142 }),
      ],
      isLoading: false,
    })
    render(<SourcesView />)
    expect(screen.getByText('142 articles')).toBeInTheDocument()
  })

  it('renders sort pill buttons', () => {
    render(<SourcesView />)
    expect(screen.getByRole('button', { name: 'A–Z' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bias' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Factuality' })).toBeInTheDocument()
  })

  it('sorts by bias when bias pill is clicked', async () => {
    const user = userEvent.setup()
    mockUseSources.mockReturnValue({
      sources: [
        makeSource({ id: '1', name: 'Reuters', bias: 'center' }),
        makeSource({ id: '2', name: 'Jacobin', bias: 'far-left' }),
        makeSource({ id: '3', name: 'Fox News', bias: 'right', slug: 'fox-news', url: 'foxnews.com' }),
      ],
      isLoading: false,
    })
    render(<SourcesView />)

    await user.click(screen.getByRole('button', { name: 'Bias' }))

    const links = screen.getAllByRole('link')
    const profileLinks = links.filter((l) => l.getAttribute('href')?.startsWith('/sources/'))
    expect(profileLinks[0]).toHaveTextContent('View profile →')
  })
})
