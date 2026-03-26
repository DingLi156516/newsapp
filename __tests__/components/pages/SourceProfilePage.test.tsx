import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SourceProfilePage } from '@/components/pages/SourceProfilePage'

const mockPush = vi.fn()
const mockUseSourceProfile = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock('@/lib/hooks/use-source-profile', () => ({
  useSourceProfile: (...args: unknown[]) => mockUseSourceProfile(...args),
}))

vi.mock('@/components/organisms/UserMenu', () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}))

describe('SourceProfilePage', () => {
  beforeEach(() => {
    mockUseSourceProfile.mockReturnValue({
      profile: {
        source: {
          id: 'src-1',
          slug: 'reuters',
          name: 'Reuters',
          bias: 'center',
          factuality: 'very-high',
          ownership: 'corporate',
          region: 'international',
          url: 'reuters.com',
          rssUrl: 'https://reuters.com/rss',
          isActive: true,
        },
        recentStories: [
          {
            id: 'story-1',
            headline: 'Top Story',
            topic: 'politics',
            region: 'us',
            timestamp: '2026-03-03T10:30:00Z',
            isBlindspot: false,
            articleUrl: 'https://reuters.com/story-1',
          },
        ],
        topicBreakdown: [
          { topic: 'politics', count: 1 },
        ],
        blindspotCount: 0,
      },
      isLoading: false,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the snapshot, recent coverage, tendencies, and methodology sections', () => {
    render(<SourceProfilePage slug="reuters" />)

    expect(screen.getByRole('heading', { name: 'Reuters' })).toBeInTheDocument()
    expect(screen.getByText('Snapshot')).toBeInTheDocument()
    expect(screen.getByText('Recent Coverage')).toBeInTheDocument()
    expect(screen.getByText('Coverage Tendencies')).toBeInTheDocument()
    expect(screen.getByText('Methodology')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Top Story' })).toHaveAttribute('href', '/story/story-1')
    expect(screen.getByRole('link', { name: 'Compare →' })).toHaveAttribute('href', '/sources/compare?left=reuters')
  })

  it('renders a not found state for unknown slugs', () => {
    mockUseSourceProfile.mockReturnValue({
      profile: null,
      isLoading: false,
    })

    render(<SourceProfilePage slug="missing-source" />)

    expect(screen.getByText('Source not found')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to directory' })).toBeInTheDocument()
  })

  it('navigates back to the source directory', async () => {
    const user = userEvent.setup()
    render(<SourceProfilePage slug="reuters" />)

    await user.click(screen.getByRole('button', { name: 'Back to directory' }))
    expect(mockPush).toHaveBeenCalledWith('/?view=sources')
  })
})
