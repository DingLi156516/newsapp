import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StickyFilterBar } from '@/components/organisms/StickyFilterBar'

vi.mock('framer-motion')

describe('StickyFilterBar', () => {
  const defaultProps = {
    feedTab: 'trending' as const,
    onFeedTabChange: vi.fn(),
    savedCount: 3,
    blindspotCount: 2,
  }

  it('renders FeedTabs with Trending active', () => {
    render(<StickyFilterBar {...defaultProps} />)
    expect(screen.getByRole('tab', { name: 'Trending' })).toBeInTheDocument()
  })

  it('does not render PerspectiveSlider', () => {
    render(<StickyFilterBar {...defaultProps} />)
    expect(screen.queryByRole('tablist', { name: 'Filter by political perspective' })).not.toBeInTheDocument()
  })

  it('calls onFeedTabChange when a tab is clicked', async () => {
    const user = userEvent.setup()
    render(<StickyFilterBar {...defaultProps} />)
    await user.click(screen.getByRole('tab', { name: 'Latest' }))
    expect(defaultProps.onFeedTabChange).toHaveBeenCalledWith('latest')
  })
})
