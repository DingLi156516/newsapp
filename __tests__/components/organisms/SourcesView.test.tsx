import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SourcesView } from '@/components/organisms/SourcesView'
import type { MediaOwner, NewsSource } from '@/lib/types'

function makeOwner(id: string, name: string): MediaOwner {
  return {
    id,
    name,
    slug: id,
    ownerType: 'public_company',
    isIndividual: false,
    country: 'US',
    wikidataQid: null,
    ownerSource: 'manual',
    ownerVerifiedAt: '2026-01-01T00:00:00Z',
  }
}

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

  it('clusters sources under owner headers when "Group by owner" is toggled on', async () => {
    const user = userEvent.setup()
    const warner = makeOwner('warner', 'Warner Bros. Discovery')
    const nyt = makeOwner('nyt', 'New York Times Co')
    mockUseSources.mockReturnValue({
      sources: [
        makeSource({ id: '1', name: 'CNN', slug: 'cnn', url: 'cnn.com' }) as NewsSource & { owner?: MediaOwner; region: string },
        makeSource({ id: '2', name: 'HBO News', slug: 'hbo', url: 'hbo.com' }) as NewsSource & { owner?: MediaOwner; region: string },
        makeSource({ id: '3', name: 'NYT', slug: 'nyt-source', url: 'nytimes.com' }) as NewsSource & { owner?: MediaOwner; region: string },
        makeSource({ id: '4', name: 'Indie News' }) as NewsSource & { owner?: MediaOwner; region: string },
      ].map((s, i) => {
        if (i === 0 || i === 1) return { ...s, owner: warner }
        if (i === 2) return { ...s, owner: nyt }
        return s
      }),
      isLoading: false,
    })
    render(<SourcesView />)

    await user.click(screen.getByTestId('group-by-owner-toggle'))

    const warnerGroup = screen.getByTestId('owner-group-warner')
    expect(within(warnerGroup).getByText('Warner Bros. Discovery')).toBeInTheDocument()
    expect(within(warnerGroup).getByText('CNN')).toBeInTheDocument()
    expect(within(warnerGroup).getByText('HBO News')).toBeInTheDocument()

    const nytGroup = screen.getByTestId('owner-group-nyt')
    expect(within(nytGroup).getByText('NYT')).toBeInTheDocument()

    const unaffiliated = screen.getByTestId('owner-group-unaffiliated')
    expect(within(unaffiliated).getByText('Indie News')).toBeInTheDocument()
  })

  it('forces flat list when ownership degrades after grouping was already enabled', async () => {
    // Start healthy + user enables grouping
    const warner = makeOwner('warner', 'Warner Bros. Discovery')
    mockUseSources.mockReturnValue({
      sources: [
        { ...makeSource({ id: '1', name: 'CNN', slug: 'cnn', url: 'cnn.com' }), owner: warner } as NewsSource & { owner?: MediaOwner; region: string },
      ],
      total: 1,
      ownershipUnavailable: false,
      isLoading: false,
    })
    const user = userEvent.setup()
    const { rerender } = render(<SourcesView />)

    await user.click(screen.getByTestId('group-by-owner-toggle'))
    expect(screen.queryByTestId('owner-grouped-list')).toBeInTheDocument()

    // Backend transitions to degraded on next SWR revalidation
    mockUseSources.mockReturnValue({
      sources: [
        { ...makeSource({ id: '1', name: 'CNN', slug: 'cnn', url: 'cnn.com' }) } as NewsSource & { owner?: MediaOwner; region: string },
      ],
      total: 1,
      ownershipUnavailable: true,
      isLoading: false,
    })
    rerender(<SourcesView />)

    // Grouped render branch must exit even though internal groupByOwner=true
    expect(screen.queryByTestId('owner-grouped-list')).toBeNull()
    expect(screen.queryByTestId('owner-group-unaffiliated')).toBeNull()
    expect(screen.getByTestId('sources-ownership-unavailable-banner')).toBeInTheDocument()
    const toggle = screen.getByTestId('group-by-owner-toggle')
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    // Sort buttons should be enabled again — otherwise the user is stranded
    // (can't toggle grouping off because it's disabled, can't sort because
    // sort keys off raw groupByOwner)
    expect(screen.getByRole('button', { name: 'A–Z' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bias' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Factuality' })).not.toBeDisabled()
  })

  it('renders a degraded banner and disables group-by-owner when ownershipUnavailable is true', () => {
    mockUseSources.mockReturnValue({
      sources: [makeSource({ id: '1', name: 'CNN' })],
      total: 1,
      ownershipUnavailable: true,
      isLoading: false,
    })
    render(<SourcesView />)

    expect(screen.getByTestId('sources-ownership-unavailable-banner')).toBeInTheDocument()
    const toggle = screen.getByTestId('group-by-owner-toggle')
    expect(toggle).toBeDisabled()
  })

  it('warns when grouped view cannot show the full directory (total > page size)', async () => {
    const user = userEvent.setup()
    const warner = makeOwner('warner', 'Warner Bros. Discovery')
    // Mock 3 returned sources but total claims 150 → banner fires
    mockUseSources.mockReturnValue({
      sources: [
        { ...makeSource({ id: '1', name: 'CNN', slug: 'cnn', url: 'cnn.com' }), owner: warner } as NewsSource & { owner?: MediaOwner; region: string },
        { ...makeSource({ id: '2', name: 'HBO', slug: 'hbo', url: 'hbo.com' }), owner: warner } as NewsSource & { owner?: MediaOwner; region: string },
        makeSource({ id: '3', name: 'Indie' }) as NewsSource & { owner?: MediaOwner; region: string },
      ],
      total: 150,
      isLoading: false,
    })
    render(<SourcesView />)

    await user.click(screen.getByTestId('group-by-owner-toggle'))

    const banner = screen.getByTestId('grouping-incomplete-banner')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent(/Showing 3 of 150/)
  })

  it('does NOT show the grouping-incomplete banner when everything fits', async () => {
    const user = userEvent.setup()
    const warner = makeOwner('warner', 'Warner Bros. Discovery')
    mockUseSources.mockReturnValue({
      sources: [
        { ...makeSource({ id: '1', name: 'CNN', slug: 'cnn', url: 'cnn.com' }), owner: warner } as NewsSource & { owner?: MediaOwner; region: string },
        { ...makeSource({ id: '2', name: 'HBO', slug: 'hbo', url: 'hbo.com' }), owner: warner } as NewsSource & { owner?: MediaOwner; region: string },
      ],
      total: 2,
      isLoading: false,
    })
    render(<SourcesView />)
    await user.click(screen.getByTestId('group-by-owner-toggle'))
    expect(screen.queryByTestId('grouping-incomplete-banner')).toBeNull()
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
