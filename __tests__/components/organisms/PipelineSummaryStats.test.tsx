import { render, screen } from '@testing-library/react'
import { PipelineSummaryStats } from '@/components/organisms/PipelineSummaryStats'

const mockUsePipelineStats = vi.fn()
const mockUseOldestPending = vi.fn()
const mockUseBacklogSnapshots = vi.fn(() => ({ snapshots: [], isLoading: false, mutate: vi.fn() }))

vi.mock('@/lib/hooks/use-pipeline', () => ({
  usePipelineStats: () => mockUsePipelineStats(),
}))

vi.mock('@/lib/hooks/use-oldest-pending', () => ({
  useOldestPending: () => mockUseOldestPending(),
}))

vi.mock('@/lib/hooks/use-backlog-snapshots', () => ({
  useBacklogSnapshots: () => mockUseBacklogSnapshots(),
}))

const baseSloPayload = {
  oldest: {
    oldestEmbedPendingAt: null,
    oldestClusterPendingAt: null,
    oldestAssemblyPendingAt: null,
  },
  stale: {
    staleEmbedClaims: 0,
    staleClusterClaims: 0,
    staleAssemblyClaims: 0,
  },
  reviewReasons: [],
}

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
    mockUseOldestPending.mockReturnValue({ payload: baseSloPayload, isLoading: false, error: null })

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
    mockUseOldestPending.mockReturnValue({ payload: null, isLoading: true, error: null })

    const { container } = render(<PipelineSummaryStats />)
    expect(container.querySelectorAll('.animate-shimmer')).toHaveLength(6)
  })

  it('has the correct data-testid', () => {
    mockUsePipelineStats.mockReturnValue({
      stats: { publishedStories: 0, totalArticles: 0, reviewQueue: 0, unembedded: 0, unclustered: 0, expiredArticles: 0 },
      isLoading: false,
    })
    mockUseOldestPending.mockReturnValue({ payload: baseSloPayload, isLoading: false, error: null })

    render(<PipelineSummaryStats />)
    expect(screen.getByTestId('pipeline-summary-stats')).toBeInTheDocument()
  })

  it('shows a visible error banner when SLO endpoint fails', () => {
    mockUsePipelineStats.mockReturnValue({
      stats: { publishedStories: 0, totalArticles: 0, reviewQueue: 0, unembedded: 0, unclustered: 0, expiredArticles: 0 },
      isLoading: false,
    })
    mockUseOldestPending.mockReturnValue({ payload: null, isLoading: false, error: 'rls denied' })

    render(<PipelineSummaryStats />)
    expect(screen.getByTestId('slo-error-banner')).toHaveTextContent('rls denied')
  })

  it('renders SLO tiles and stale-claim count when payload present', () => {
    mockUsePipelineStats.mockReturnValue({
      stats: { publishedStories: 1, totalArticles: 1, reviewQueue: 1, unembedded: 1, unclustered: 1, expiredArticles: 1 },
      isLoading: false,
    })
    mockUseOldestPending.mockReturnValue({
      payload: {
        oldest: {
          oldestEmbedPendingAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          oldestClusterPendingAt: null,
          oldestAssemblyPendingAt: null,
        },
        stale: { staleEmbedClaims: 3, staleClusterClaims: 1, staleAssemblyClaims: 0 },
        reviewReasons: [{ reason: 'sparse_coverage', count: 2 }],
      },
      isLoading: false,
      error: null,
    })

    render(<PipelineSummaryStats />)
    expect(screen.getByTestId('pipeline-slo-tiles')).toBeInTheDocument()
    expect(screen.getByTestId('stale-claims-tile')).toHaveTextContent('4')
    expect(screen.getByTestId('review-reason-breakdown')).toHaveTextContent('sparse coverage')
  })
})
