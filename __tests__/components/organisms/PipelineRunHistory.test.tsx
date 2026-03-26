import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/hooks/use-pipeline', () => ({
  usePipelineRuns: vi.fn(),
}))

import { usePipelineRuns } from '@/lib/hooks/use-pipeline'
import { PipelineRunHistory } from '@/components/organisms/PipelineRunHistory'
import type { DbPipelineRun } from '@/lib/supabase/types'

const mockUsePipelineRuns = vi.mocked(usePipelineRuns)

const mockRuns: DbPipelineRun[] = [
  {
    id: 'run-1',
    run_type: 'ingest',
    triggered_by: 'cron',
    status: 'completed',
    started_at: '2026-03-18T10:00:00Z',
    completed_at: '2026-03-18T10:00:05Z',
    duration_ms: 5000,
    steps: [
      { step: 'fetch_feeds', status: 'success', duration_ms: 3000 },
      { step: 'dedup', status: 'success', duration_ms: 2000 },
    ],
    summary: null,
    error: null,
    created_at: '2026-03-18T10:00:00Z',
  },
  {
    id: 'run-2',
    run_type: 'full',
    triggered_by: 'manual',
    status: 'failed',
    started_at: '2026-03-18T09:00:00Z',
    completed_at: '2026-03-18T09:00:10Z',
    duration_ms: 10000,
    steps: [
      { step: 'fetch_feeds', status: 'success', duration_ms: 4000 },
      { step: 'embed', status: 'error', duration_ms: 6000, error: 'API rate limited' },
    ],
    summary: null,
    error: 'Pipeline failed at embed step',
    created_at: '2026-03-18T09:00:00Z',
  },
  {
    id: 'run-3',
    run_type: 'process',
    triggered_by: 'admin',
    status: 'completed',
    started_at: '2026-03-18T11:00:00Z',
    completed_at: '2026-03-18T11:00:20Z',
    duration_ms: 20000,
    steps: [
      { step: 'assemble_pass_1', status: 'success', duration_ms: 4000 },
      { step: 'cluster_pass_1', status: 'success', duration_ms: 7000 },
    ],
    summary: {
      backlog: {
        before: {
          unembeddedArticles: 3475,
          unclusteredArticles: 2636,
          pendingAssemblyStories: 3,
          reviewQueueStories: 56,
          expiredArticles: 0,
        },
        after: {
          unembeddedArticles: 3475,
          unclusteredArticles: 2400,
          pendingAssemblyStories: 0,
          reviewQueueStories: 57,
          expiredArticles: 0,
        },
      },
      embeddings: {
        totalProcessed: 0,
        claimedArticles: 0,
        errors: [],
        passes: 0,
        skipped: true,
        skipReason: 'budget_reserved_for_downstream',
      },
      clustering: {
        newStories: 2,
        updatedStories: 1,
        assignedArticles: 8,
        expiredArticles: 0,
        promotedSingletons: 0,
        unmatchedSingletons: 3,
        errors: [],
        passes: 1,
        skipped: false,
        skipReason: null,
      },
      assembly: {
        storiesProcessed: 3,
        claimedStories: 3,
        autoPublished: 2,
        sentToReview: 1,
        errors: [],
        passes: 1,
        skipped: false,
        skipReason: null,
      },
    },
    error: null,
    created_at: '2026-03-18T11:00:00Z',
  },
]

describe('PipelineRunHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton when loading', () => {
    mockUsePipelineRuns.mockReturnValue({
      runs: [],
      isLoading: true,
      mutate: vi.fn(),
    })

    const { container } = render(<PipelineRunHistory />)

    // Skeleton elements are rendered (animate-shimmer divs)
    const skeletons = container.querySelectorAll('.animate-shimmer')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty state when no runs', () => {
    mockUsePipelineRuns.mockReturnValue({
      runs: [],
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<PipelineRunHistory />)

    expect(screen.getByText('No pipeline runs recorded yet')).toBeInTheDocument()
  })

  it('renders run rows with type, status, and duration', () => {
    mockUsePipelineRuns.mockReturnValue({
      runs: mockRuns,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<PipelineRunHistory />)

    expect(screen.getByText('ingest')).toBeInTheDocument()
    expect(screen.getByText('full')).toBeInTheDocument()
    expect(screen.getAllByText('completed')).toHaveLength(2)
    expect(screen.getByText('failed')).toBeInTheDocument()
    expect(screen.getByText('5.0s')).toBeInTheDocument()
    expect(screen.getByText('10.0s')).toBeInTheDocument()
  })

  it('renders triggered_by info', () => {
    mockUsePipelineRuns.mockReturnValue({
      runs: mockRuns,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<PipelineRunHistory />)

    expect(screen.getByText('cron')).toBeInTheDocument()
    expect(screen.getByText('manual')).toBeInTheDocument()
  })

  it('clicking a run row expands step details', () => {
    mockUsePipelineRuns.mockReturnValue({
      runs: mockRuns,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<PipelineRunHistory />)

    // Steps should not be visible initially
    expect(screen.queryByText('fetch_feeds')).not.toBeInTheDocument()

    // Click the first run row
    fireEvent.click(screen.getByText('ingest'))

    // Steps should now be visible
    expect(screen.getByText('fetch_feeds')).toBeInTheDocument()
    expect(screen.getByText('dedup')).toBeInTheDocument()
  })

  it('shows error messages for failed runs when expanded', () => {
    mockUsePipelineRuns.mockReturnValue({
      runs: mockRuns,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<PipelineRunHistory />)

    // Click the failed run row
    fireEvent.click(screen.getByText('full'))

    expect(screen.getByText('Pipeline failed at embed step')).toBeInTheDocument()
  })

  it('renders the Run History heading', () => {
    mockUsePipelineRuns.mockReturnValue({
      runs: mockRuns,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<PipelineRunHistory />)

    expect(screen.getByText('Run History')).toBeInTheDocument()
  })

  it('shows backlog deltas and skip reasons for process runs when expanded', () => {
    mockUsePipelineRuns.mockReturnValue({
      runs: mockRuns,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<PipelineRunHistory />)

    fireEvent.click(screen.getByText('process'))

    const expandedPanel = screen.getByText('assemble_pass_1').closest('.border-t')
    expect(expandedPanel).not.toBeNull()
    expect(expandedPanel).toHaveTextContent('unembedded 3475 -> 3475')
    expect(expandedPanel).toHaveTextContent('unclustered 2636 -> 2400')
    expect(expandedPanel).toHaveTextContent('pending assembly 3 -> 0')
    expect(expandedPanel).toHaveTextContent('review 56 -> 57')
    expect(screen.getByText('embeddings skipped: budget reserved for downstream')).toBeInTheDocument()
    expect(screen.getByText('clustering 1 pass')).toBeInTheDocument()
    expect(screen.getByText('assembly 1 pass')).toBeInTheDocument()
  })
})
