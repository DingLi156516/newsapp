import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SourceComparisonPage } from '@/components/pages/SourceComparisonPage'

const mockPush = vi.fn()
const mockUseSourceComparison = vi.fn()
const mockUseSources = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock('@/lib/hooks/use-source-comparison', () => ({
  useSourceComparison: (...args: unknown[]) => mockUseSourceComparison(...args),
}))

vi.mock('@/lib/hooks/use-sources', () => ({
  useSources: (...args: unknown[]) => mockUseSources(...args),
}))

vi.mock('@/components/organisms/UserMenu', () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}))

describe('SourceComparisonPage', () => {
  beforeEach(() => {
    mockUseSources.mockReturnValue({
      sources: [
        {
          id: 'src-1',
          slug: 'reuters',
          name: 'Reuters',
          bias: 'center',
          factuality: 'very-high',
          ownership: 'corporate',
          region: 'international',
        },
        {
          id: 'src-2',
          slug: 'fox-news',
          name: 'Fox News',
          bias: 'right',
          factuality: 'mixed',
          ownership: 'corporate',
          region: 'us',
        },
      ],
      isLoading: false,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the picker state when only the left source is selected', () => {
    mockUseSourceComparison.mockReturnValue({
      comparison: null,
      isLoading: false,
      isError: false,
    })

    render(<SourceComparisonPage leftSlug="reuters" rightSlug={null} />)

    expect(screen.getByText('Choose a second source')).toBeInTheDocument()
    expect(screen.getByLabelText('Compare against')).toBeInTheDocument()
  })

  it('renders snapshot, shared coverage, gaps, and methodology sections', () => {
    mockUseSourceComparison.mockReturnValue({
      comparison: {
        leftSource: {
          id: 'src-1',
          slug: 'reuters',
          name: 'Reuters',
          bias: 'center',
          factuality: 'very-high',
          ownership: 'corporate',
          region: 'international',
          isActive: true,
        },
        rightSource: {
          id: 'src-2',
          slug: 'fox-news',
          name: 'Fox News',
          bias: 'right',
          factuality: 'mixed',
          ownership: 'corporate',
          region: 'us',
          isActive: true,
        },
        sharedStories: [
          {
            id: 'story-1',
            headline: 'Shared Story',
            topic: 'politics',
            region: 'us',
            timestamp: '2026-03-03T10:00:00Z',
            isBlindspot: false,
          },
        ],
        leftExclusiveStories: [],
        rightExclusiveStories: [],
        stats: {
          sharedStoryCount: 1,
          leftExclusiveCount: 0,
          rightExclusiveCount: 0,
          leftBlindspotCount: 0,
          rightBlindspotCount: 1,
          overlappingTopics: [{ topic: 'politics', leftCount: 1, rightCount: 1 }],
          topicImbalances: [],
        },
      },
      isLoading: false,
      isError: false,
    })

    render(<SourceComparisonPage leftSlug="reuters" rightSlug="fox-news" />)

    expect(screen.getByText('Side-by-Side Snapshot')).toBeInTheDocument()
    expect(screen.getByText('Shared Coverage')).toBeInTheDocument()
    expect(screen.getByText('Coverage Gaps')).toBeInTheDocument()
    expect(screen.getByText('Methodology')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Shared Story' })).toHaveAttribute('href', '/story/story-1')
  })

  it('renders an empty shared coverage state cleanly', () => {
    mockUseSourceComparison.mockReturnValue({
      comparison: {
        leftSource: {
          id: 'src-1',
          slug: 'reuters',
          name: 'Reuters',
          bias: 'center',
          factuality: 'very-high',
          ownership: 'corporate',
          region: 'international',
          isActive: true,
        },
        rightSource: {
          id: 'src-2',
          slug: 'fox-news',
          name: 'Fox News',
          bias: 'right',
          factuality: 'mixed',
          ownership: 'corporate',
          region: 'us',
          isActive: true,
        },
        sharedStories: [],
        leftExclusiveStories: [],
        rightExclusiveStories: [],
        stats: {
          sharedStoryCount: 0,
          leftExclusiveCount: 0,
          rightExclusiveCount: 0,
          leftBlindspotCount: 0,
          rightBlindspotCount: 0,
          overlappingTopics: [],
          topicImbalances: [],
        },
      },
      isLoading: false,
      isError: false,
    })

    render(<SourceComparisonPage leftSlug="reuters" rightSlug="fox-news" />)

    expect(screen.getByText('These sources did not overlap on any recent stories in this window.')).toBeInTheDocument()
  })

  it('updates the URL when a second source is selected', async () => {
    const user = userEvent.setup()
    mockUseSourceComparison.mockReturnValue({
      comparison: null,
      isLoading: false,
      isError: false,
    })

    render(<SourceComparisonPage leftSlug="reuters" rightSlug={null} />)

    await user.selectOptions(screen.getByLabelText('Compare against'), 'fox-news')

    expect(mockPush).toHaveBeenCalledWith('/sources/compare?left=reuters&right=fox-news')
  })
})
