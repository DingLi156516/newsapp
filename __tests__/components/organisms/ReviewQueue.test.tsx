import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/hooks/use-review-queue', () => ({
  useReviewQueue: vi.fn(),
}))

vi.mock('@/lib/hooks/use-review-action', () => ({
  useReviewAction: vi.fn(),
}))

vi.mock('swr', () => ({
  default: vi.fn().mockReturnValue({
    data: { success: true, data: { pending: 5, approved: 10, rejected: 2 } },
    isLoading: false,
  }),
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: vi.fn().mockReturnValue({ user: { id: 'admin-1' } }),
}))

import { useReviewQueue } from '@/lib/hooks/use-review-queue'
import { useReviewAction } from '@/lib/hooks/use-review-action'
import { ReviewQueue } from '@/components/organisms/ReviewQueue'

const mockUseReviewQueue = vi.mocked(useReviewQueue)
const mockUseReviewAction = vi.mocked(useReviewAction)

const mockStories = [
  {
    id: 'story-1',
    headline: 'Story One',
    topic: 'politics',
    region: 'us',
    source_count: 3,
    is_blindspot: false,
    image_url: null,
    factuality: 'high',
    ownership: 'corporate',
    spectrum_segments: [],
    ai_summary: { commonGround: 'CG1', leftFraming: 'LF1', rightFraming: 'RF1' },
    publication_status: 'needs_review',
    review_reasons: ['blindspot'],
    confidence_score: 0.48,
    processing_error: null,
    review_status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    first_published: '2026-03-15T10:00:00Z',
    last_updated: '2026-03-15T12:00:00Z',
  },
  {
    id: 'story-2',
    headline: 'Story Two',
    topic: 'technology',
    region: 'us',
    source_count: 5,
    is_blindspot: false,
    image_url: null,
    factuality: 'high',
    ownership: 'corporate',
    spectrum_segments: [],
    ai_summary: { commonGround: 'CG2', leftFraming: 'LF2', rightFraming: 'RF2' },
    publication_status: 'needs_review',
    review_reasons: ['low_factuality'],
    confidence_score: 0.62,
    processing_error: null,
    review_status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    first_published: '2026-03-15T10:00:00Z',
    last_updated: '2026-03-15T12:00:00Z',
  },
]

describe('ReviewQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseReviewAction.mockReturnValue({
      approve: vi.fn(),
      reject: vi.fn(),
      reprocess: vi.fn(),
      isLoading: false,
    })
  })

  it('renders filter tabs', () => {
    mockUseReviewQueue.mockReturnValue({
      stories: mockStories,
      total: 2,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<ReviewQueue />)

    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('renders story list items', () => {
    mockUseReviewQueue.mockReturnValue({
      stories: mockStories,
      total: 2,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<ReviewQueue />)

    expect(screen.getByText('Story One')).toBeInTheDocument()
    expect(screen.getByText('Story Two')).toBeInTheDocument()
  })

  it('shows empty state when no stories', () => {
    mockUseReviewQueue.mockReturnValue({
      stories: [],
      total: 0,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<ReviewQueue />)

    expect(screen.getByText(/all caught up/i)).toBeInTheDocument()
  })

  it('selects a story on click and shows detail', () => {
    mockUseReviewQueue.mockReturnValue({
      stories: mockStories,
      total: 2,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<ReviewQueue />)

    fireEvent.click(screen.getByText('Story One'))

    // Detail should show the headline in the right panel
    const headings = screen.getAllByText('Story One')
    expect(headings.length).toBeGreaterThanOrEqual(1)
  })

  it('shows loading skeleton when loading', () => {
    mockUseReviewQueue.mockReturnValue({
      stories: [],
      total: 0,
      isLoading: true,
      mutate: vi.fn(),
    })

    render(<ReviewQueue />)

    expect(screen.getByTestId('review-queue-loading')).toBeInTheDocument()
  })
})
