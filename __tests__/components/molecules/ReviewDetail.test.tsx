import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/hooks/use-routing-preview', () => ({
  useRoutingPreview: () => ({ preview: null, isLoading: false, error: null }),
}))

import { ReviewDetail } from '@/components/molecules/ReviewDetail'

const mockStory = {
  id: 'story-1',
  headline: 'Test Story Headline',
  topic: 'politics',
  region: 'us',
  source_count: 5,
  is_blindspot: false,
  image_url: null,
  factuality: 'high',
  ownership: 'corporate',
  spectrum_segments: [
    { bias: 'left', percentage: 40 },
    { bias: 'center', percentage: 30 },
    { bias: 'right', percentage: 30 },
  ],
  ai_summary: {
    commonGround: 'Common ground text',
    leftFraming: 'Left framing text',
    rightFraming: 'Right framing text',
  },
  publication_status: 'needs_review',
  review_reasons: ['blindspot', 'low_factuality'],
  confidence_score: 0.48,
  processing_error: 'legacy_data_repair',
  review_status: 'pending',
  reviewed_by: null,
  reviewed_at: null,
  first_published: '2026-03-15T10:00:00Z',
  last_updated: '2026-03-15T12:00:00Z',
}

describe('ReviewDetail', () => {
  const defaultProps = {
    story: mockStory,
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onReprocess: vi.fn(),
    isLoading: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders headline in view mode', () => {
    render(<ReviewDetail {...defaultProps} />)
    expect(screen.getByText('Test Story Headline')).toBeInTheDocument()
  })

  it('renders AI summary sections', () => {
    render(<ReviewDetail {...defaultProps} />)
    expect(screen.getByText('Common Ground')).toBeInTheDocument()
    expect(screen.getByText('Left Perspective')).toBeInTheDocument()
    expect(screen.getByText('Right Perspective')).toBeInTheDocument()
    expect(screen.getByText('Common ground text')).toBeInTheDocument()
  })

  it('renders confidence and review reasons', () => {
    render(<ReviewDetail {...defaultProps} />)
    expect(screen.getByText('48% confidence')).toBeInTheDocument()
    expect(screen.getByText('blindspot')).toBeInTheDocument()
    expect(screen.getByText('low_factuality')).toBeInTheDocument()
    expect(screen.getByText('legacy_data_repair')).toBeInTheDocument()
  })

  it('renders action buttons', () => {
    render(<ReviewDetail {...defaultProps} />)
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reprocess/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('calls onApprove when approve button clicked', () => {
    render(<ReviewDetail {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(defaultProps.onApprove).toHaveBeenCalledWith('story-1', undefined)
  })

  it('calls onReject when reject button clicked', () => {
    render(<ReviewDetail {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    expect(defaultProps.onReject).toHaveBeenCalledWith('story-1')
  })

  it('calls onReprocess when reprocess button clicked', () => {
    render(<ReviewDetail {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /reprocess/i }))
    expect(defaultProps.onReprocess).toHaveBeenCalledWith('story-1')
  })

  it('enters edit mode when edit button clicked', () => {
    render(<ReviewDetail {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    // In edit mode, headline should be in a textarea
    expect(screen.getByDisplayValue('Test Story Headline')).toBeInTheDocument()
  })

  it('shows cancel button in edit mode', () => {
    render(<ReviewDetail {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('exits edit mode on cancel', () => {
    render(<ReviewDetail {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    // Back to view mode — no textarea
    expect(screen.queryByDisplayValue('Test Story Headline')).not.toBeInTheDocument()
  })

  it('shows save and approve button in edit mode', () => {
    render(<ReviewDetail {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByRole('button', { name: /save & approve/i })).toBeInTheDocument()
  })

  it('disables buttons when loading', () => {
    render(<ReviewDetail {...defaultProps} isLoading={true} />)
    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /reject/i })).toBeDisabled()
  })

  it('renders empty state when no story', () => {
    render(<ReviewDetail {...defaultProps} story={null} />)
    expect(screen.getByText(/select a story/i)).toBeInTheDocument()
  })
})
