import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TopicPills } from '@/components/organisms/TopicPills'
import type { StoryTag } from '@/lib/types'

vi.mock('framer-motion')

const mockPromotedTags: StoryTag[] = [
  { slug: 'donald-trump', label: 'Trump', type: 'person', storyCount: 47, relevance: 1 },
  { slug: 'nato', label: 'NATO', type: 'organization', storyCount: 23, relevance: 1 },
  { slug: 'ai-regulation', label: 'AI Regulation', type: 'topic', storyCount: 18, relevance: 1 },
]

describe('TopicPills', () => {
  it('renders 10 pills (All + 9 topics)', () => {
    render(<TopicPills selected={null} onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(10)
  })

  it('"All" pill has aria-pressed="true" when selected=null', () => {
    render(<TopicPills selected={null} onChange={vi.fn()} />)
    const allPill = screen.getByRole('button', { name: 'All' })
    expect(allPill).toHaveAttribute('aria-pressed', 'true')
  })

  it('"All" pill has aria-pressed="false" when a topic is selected', () => {
    render(<TopicPills selected="technology" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('selected topic pill has aria-pressed="true"', () => {
    render(<TopicPills selected="technology" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Technology' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('clicking "Technology" calls onChange("technology")', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TopicPills selected={null} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Technology' }))
    expect(onChange).toHaveBeenCalledWith('technology')
  })

  it('clicking "All" calls onChange(null)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TopicPills selected="politics" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('clicking the already-selected pill calls onChange with the same value', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TopicPills selected="health" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Health' }))
    expect(onChange).toHaveBeenCalledWith('health')
  })

  // --- Promoted tags tests ---

  it('renders promoted tags after divider when provided', () => {
    render(
      <TopicPills
        selected={null}
        onChange={vi.fn()}
        promotedTags={mockPromotedTags}
      />
    )

    expect(screen.getByTestId('promoted-tag-donald-trump')).toBeInTheDocument()
    expect(screen.getByTestId('promoted-tag-nato')).toBeInTheDocument()
    expect(screen.getByTestId('promoted-tag-ai-regulation')).toBeInTheDocument()
    // 10 topics + 3 promoted = 13 buttons
    expect(screen.getAllByRole('button')).toHaveLength(13)
  })

  it('does not render divider when no promoted tags', () => {
    const { container } = render(
      <TopicPills selected={null} onChange={vi.fn()} />
    )
    expect(container.textContent).not.toContain('|')
  })

  it('clicking a promoted tag calls onTagChange', async () => {
    const onTagChange = vi.fn()
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <TopicPills
        selected={null}
        onChange={onChange}
        promotedTags={mockPromotedTags}
        selectedTag={null}
        onTagChange={onTagChange}
      />
    )

    await user.click(screen.getByTestId('promoted-tag-nato'))

    expect(onTagChange).toHaveBeenCalledWith({ slug: 'nato', type: 'organization' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('promoted tag has aria-pressed="true" when selected', () => {
    render(
      <TopicPills
        selected={null}
        onChange={vi.fn()}
        promotedTags={mockPromotedTags}
        selectedTag={{ slug: 'donald-trump', type: 'person' }}
        onTagChange={vi.fn()}
      />
    )

    expect(screen.getByTestId('promoted-tag-donald-trump')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('promoted-tag-nato')).toHaveAttribute('aria-pressed', 'false')
  })

  it('mutual exclusion: topic pills not active when a promoted tag is selected', () => {
    render(
      <TopicPills
        selected="politics"
        onChange={vi.fn()}
        promotedTags={mockPromotedTags}
        selectedTag={{ slug: 'donald-trump' }}
        onTagChange={vi.fn()}
      />
    )

    // No topic should be active because a tag is selected
    expect(screen.getByTestId('topic-pill-all')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('topic-pill-politics')).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking a topic does not call onTagChange', async () => {
    const onTagChange = vi.fn()
    const user = userEvent.setup()
    render(
      <TopicPills
        selected={null}
        onChange={vi.fn()}
        promotedTags={mockPromotedTags}
        selectedTag={{ slug: 'nato' }}
        onTagChange={onTagChange}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Technology' }))

    expect(onTagChange).not.toHaveBeenCalled()
  })

  it('clicking an already-active promoted tag deselects it', async () => {
    const onTagChange = vi.fn()
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <TopicPills
        selected={null}
        onChange={onChange}
        promotedTags={mockPromotedTags}
        selectedTag={{ slug: 'nato', type: 'organization' }}
        onTagChange={onTagChange}
      />
    )

    await user.click(screen.getByTestId('promoted-tag-nato'))

    expect(onTagChange).toHaveBeenCalledWith(null)
    // Should NOT call onChange(null) when deselecting — topic stays as-is
    expect(onChange).not.toHaveBeenCalled()
  })

  it('distinguishes promoted tags with same slug but different type', () => {
    const duplicateSlugTags: StoryTag[] = [
      { slug: 'apple', label: 'Apple Inc', type: 'organization', storyCount: 30, relevance: 1 },
      { slug: 'apple', label: 'Apple', type: 'topic', storyCount: 12, relevance: 1 },
    ]
    render(
      <TopicPills
        selected={null}
        onChange={vi.fn()}
        promotedTags={duplicateSlugTags}
        selectedTag={{ slug: 'apple', type: 'organization' }}
        onTagChange={vi.fn()}
      />
    )

    const buttons = screen.getAllByRole('button')
    // 10 topics + 2 promoted = 12 buttons
    expect(buttons).toHaveLength(12)
    // Both have data-testid with slug only, but only the organization one should be pressed
    const promotedButtons = buttons.filter(b => b.getAttribute('aria-pressed') === 'true')
    expect(promotedButtons).toHaveLength(1)
    expect(promotedButtons[0]).toHaveTextContent('Apple Inc')
  })

  it('does not render divider when promotedTags is empty array', () => {
    const { container } = render(
      <TopicPills selected={null} onChange={vi.fn()} promotedTags={[]} />
    )
    expect(container.textContent).not.toContain('|')
    expect(screen.getAllByRole('button')).toHaveLength(10) // only fixed topics
  })
})
