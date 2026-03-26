import { render, screen } from '@testing-library/react'
import { PipelineSummaryStats } from '@/components/organisms/PipelineSummaryStats'

const mockUsePipelineStats = vi.fn()

vi.mock('@/lib/hooks/use-pipeline', () => ({
  usePipelineStats: () => mockUsePipelineStats(),
}))

describe('PipelineSummaryStats', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders live cumulative stats from the API', () => {
    mockUsePipelineStats.mockReturnValue({
      stats: {
        publishedStories: 173,
        totalArticles: 6825,
        reviewQueue: 2,
        unembedded: 3025,
        unclustered: 2043,
        expiredArticles: 512,
      },
      isLoading: false,
    })

    render(<PipelineSummaryStats />)

    expect(screen.getByText('173')).toBeInTheDocument()
    expect(screen.getByText('6,825')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3,025')).toBeInTheDocument()
    expect(screen.getByText('2,043')).toBeInTheDocument()
    expect(screen.getByText('512')).toBeInTheDocument()
  })

  it('renders loading skeletons when loading', () => {
    mockUsePipelineStats.mockReturnValue({ stats: null, isLoading: true })

    const { container } = render(<PipelineSummaryStats />)
    expect(container.querySelectorAll('.animate-shimmer')).toHaveLength(6)
  })

  it('has the correct data-testid', () => {
    mockUsePipelineStats.mockReturnValue({
      stats: { publishedStories: 0, totalArticles: 0, reviewQueue: 0, unembedded: 0, unclustered: 0, expiredArticles: 0 },
      isLoading: false,
    })

    render(<PipelineSummaryStats />)
    expect(screen.getByTestId('pipeline-summary-stats')).toBeInTheDocument()
  })
})
