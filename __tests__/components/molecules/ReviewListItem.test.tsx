import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReviewListItem } from '@/components/molecules/ReviewListItem'

const mockStory = {
  id: 'story-1',
  headline: 'Test Headline for Review',
  topic: 'politics',
  source_count: 5,
  review_reasons: ['blindspot'],
  confidence_score: 0.48,
  review_status: 'pending' as const,
  first_published: '2026-03-15T10:00:00Z',
}

describe('ReviewListItem', () => {
  it('renders headline', () => {
    render(
      <ReviewListItem
        story={mockStory}
        isSelected={false}
        isEditing={false}
        onClick={vi.fn()}
      />
    )
    expect(screen.getByText('Test Headline for Review')).toBeInTheDocument()
  })

  it('renders topic label', () => {
    render(
      <ReviewListItem
        story={mockStory}
        isSelected={false}
        isEditing={false}
        onClick={vi.fn()}
      />
    )
    expect(screen.getByText('Politics')).toBeInTheDocument()
  })

  it('renders source count', () => {
    render(
      <ReviewListItem
        story={mockStory}
        isSelected={false}
        isEditing={false}
        onClick={vi.fn()}
      />
    )
    expect(screen.getByText('5 sources')).toBeInTheDocument()
  })

  it('renders review reason and confidence summary', () => {
    render(
      <ReviewListItem
        story={mockStory}
        isSelected={false}
        isEditing={false}
        onClick={vi.fn()}
      />
    )
    expect(screen.getByText('blindspot')).toBeInTheDocument()
    expect(screen.getByText('48%')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(
      <ReviewListItem
        story={mockStory}
        isSelected={false}
        isEditing={false}
        onClick={onClick}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledWith('story-1')
  })

  it('shows selected state with amber border', () => {
    const { container } = render(
      <ReviewListItem
        story={mockStory}
        isSelected={true}
        isEditing={false}
        onClick={vi.fn()}
      />
    )
    expect(container.firstChild).toHaveClass('border-l-amber-400')
  })

  it('shows editing state with blue border and badge', () => {
    const { container } = render(
      <ReviewListItem
        story={mockStory}
        isSelected={true}
        isEditing={true}
        onClick={vi.fn()}
      />
    )
    expect(container.firstChild).toHaveClass('border-l-blue-400')
    expect(screen.getByText('Editing')).toBeInTheDocument()
  })
})
