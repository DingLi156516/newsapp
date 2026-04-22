import { render, screen } from '@testing-library/react'
import { OwnerProfilePage } from '@/components/pages/OwnerProfilePage'

const mockBack = vi.fn()
const mockUseOwnerProfile = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: mockBack,
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('@/lib/hooks/use-owner-profile', () => ({
  useOwnerProfile: (...args: unknown[]) => mockUseOwnerProfile(...args),
}))

vi.mock('@/components/organisms/UserMenu', () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}))

const baseProfile = {
  owner: {
    id: 'owner-1',
    name: 'Fox Corporation',
    slug: 'fox-corporation',
    ownerType: 'public_company',
    isIndividual: false,
    country: 'United States',
    wikidataQid: 'Q186068',
    ownerSource: 'wikidata',
    ownerVerifiedAt: '2026-04-01T00:00:00Z',
  },
  sources: [
    {
      id: 'src-1',
      slug: 'fox-news',
      name: 'Fox News',
      bias: 'right',
      factuality: 'mixed',
      ownership: 'corporate',
      region: 'us',
      url: 'foxnews.com',
    },
  ],
  recentStories: [
    {
      id: 'story-1',
      headline: 'Top Story',
      topic: 'politics',
      region: 'us',
      timestamp: '2026-03-03T10:30:00Z',
      isBlindspot: false,
      articleUrl: 'https://foxnews.com/story-1',
    },
  ],
  topicBreakdown: [{ topic: 'politics', count: 1 }],
  storyCount: 1,
  blindspotCount: 0,
  biasDistribution: [{ bias: 'right', percentage: 100 }],
}

describe('OwnerProfilePage', () => {
  beforeEach(() => {
    mockUseOwnerProfile.mockReturnValue({
      profile: baseProfile,
      isLoading: false,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders header, snapshot, sources, recent coverage, and methodology', () => {
    render(<OwnerProfilePage slug="fox-corporation" />)

    expect(screen.getByRole('heading', { name: 'Fox Corporation' })).toBeInTheDocument()
    expect(screen.getByText('Snapshot')).toBeInTheDocument()
    expect(screen.getByText('Coverage Tendencies')).toBeInTheDocument()
    expect(screen.getByTestId('owner-profile-sources')).toBeInTheDocument()
    expect(screen.getByText('Recent Coverage')).toBeInTheDocument()
    expect(screen.getByText('Methodology')).toBeInTheDocument()
  })

  it('wires the View feed CTA to the owner-filtered latest feed', () => {
    render(<OwnerProfilePage slug="fox-corporation" />)

    const viewFeed = screen.getByTestId('owner-profile-view-feed')
    expect(viewFeed).toHaveAttribute('href', '/?owner=fox-corporation&tab=latest')
  })

  it('links each source card to the source profile', () => {
    render(<OwnerProfilePage slug="fox-corporation" />)

    const sourceCards = screen.getAllByTestId('owner-profile-source-card')
    expect(sourceCards).toHaveLength(1)
    expect(sourceCards[0]).toHaveAttribute('href', '/sources/fox-news')
  })

  it('links recent stories to the story detail route', () => {
    render(<OwnerProfilePage slug="fox-corporation" />)

    expect(screen.getByRole('link', { name: 'Top Story' })).toHaveAttribute(
      'href',
      '/story/story-1'
    )
  })

  it('shows the loading skeleton while fetching', () => {
    mockUseOwnerProfile.mockReturnValue({ profile: null, isLoading: true })
    const { container } = render(<OwnerProfilePage slug="fox-corporation" />)
    // Skeleton renders presentational placeholders; we just assert header/sections
    // aren't in the DOM yet.
    expect(screen.queryByText('Snapshot')).not.toBeInTheDocument()
    expect(container.querySelector('[data-testid="owner-profile-header"]')).toBeNull()
  })

  it('shows a not-found state when the hook reports a 404', () => {
    mockUseOwnerProfile.mockReturnValue({
      profile: null,
      isLoading: false,
      isError: false,
      notFound: true,
    })
    render(<OwnerProfilePage slug="missing-owner" />)
    expect(screen.getByTestId('owner-profile-not-found')).toBeInTheDocument()
    expect(screen.getByText('Owner not found')).toBeInTheDocument()
  })

  it('shows a distinct error state when the request fails with a non-404', () => {
    mockUseOwnerProfile.mockReturnValue({
      profile: null,
      isLoading: false,
      isError: true,
      notFound: false,
    })
    render(<OwnerProfilePage slug="fox-corporation" />)
    expect(screen.getByTestId('owner-profile-error')).toBeInTheDocument()
    expect(screen.queryByTestId('owner-profile-not-found')).not.toBeInTheDocument()
  })
})
