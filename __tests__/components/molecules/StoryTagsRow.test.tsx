import { render, screen } from '@testing-library/react'
import { StoryTagsRow } from '@/components/molecules/StoryTagsRow'
import type { StoryTag } from '@/lib/types'

const makeTags = (count: number): StoryTag[] =>
  Array.from({ length: count }, (_, i) => ({
    slug: `tag-${i}`,
    label: `Tag ${i}`,
    type: 'person' as const,
    relevance: (count - i) / count,
    storyCount: 1,
  }))

describe('StoryTagsRow', () => {
  it('renders nothing when tags array is empty', () => {
    const { container } = render(<StoryTagsRow tags={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders all tags when under the default max', () => {
    const tags = makeTags(3)
    render(<StoryTagsRow tags={tags} />)
    expect(screen.getByText('Tag 0')).toBeInTheDocument()
    expect(screen.getByText('Tag 1')).toBeInTheDocument()
    expect(screen.getByText('Tag 2')).toBeInTheDocument()
  })

  it('caps display at default max of 8', () => {
    const tags = makeTags(12)
    render(<StoryTagsRow tags={tags} />)
    // Should show 8, highest relevance first
    for (let i = 0; i < 8; i++) {
      expect(screen.getByText(`Tag ${i}`)).toBeInTheDocument()
    }
    expect(screen.queryByText('Tag 8')).not.toBeInTheDocument()
  })

  it('respects custom max prop', () => {
    const tags = makeTags(5)
    render(<StoryTagsRow tags={tags} max={2} />)
    expect(screen.getByText('Tag 0')).toBeInTheDocument()
    expect(screen.getByText('Tag 1')).toBeInTheDocument()
    expect(screen.queryByText('Tag 2')).not.toBeInTheDocument()
  })

  it('sorts tags by relevance descending', () => {
    const tags: StoryTag[] = [
      { slug: 'low', label: 'Low', type: 'person', relevance: 0.1, storyCount: 1 },
      { slug: 'high', label: 'High', type: 'person', relevance: 0.9, storyCount: 1 },
      { slug: 'mid', label: 'Mid', type: 'person', relevance: 0.5, storyCount: 1 },
    ]
    render(<StoryTagsRow tags={tags} max={2} />)
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Mid')).toBeInTheDocument()
    expect(screen.queryByText('Low')).not.toBeInTheDocument()
  })
})
