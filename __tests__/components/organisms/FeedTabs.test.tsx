import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeedTabs } from '@/components/organisms/FeedTabs'

vi.mock('framer-motion')

describe('FeedTabs', () => {
  it('renders all 5 tab labels with For You first', () => {
    render(<FeedTabs value="trending" onChange={vi.fn()} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(5)
    expect(tabs[0]).toHaveTextContent('For You')
    expect(screen.getByRole('tab', { name: 'For You' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Trending' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Latest' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Blindspot' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Saved/ })).toBeInTheDocument()
  })

  it('selected tab has aria-selected="true"', () => {
    render(<FeedTabs value="latest" onChange={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Latest' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Trending' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('clicking "Latest" calls onChange("latest")', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FeedTabs value="trending" onChange={onChange} />)
    await user.click(screen.getByRole('tab', { name: 'Latest' }))
    expect(onChange).toHaveBeenCalledWith('latest')
  })

  it('savedCount=3: renders badge "3" on Saved tab', () => {
    render(<FeedTabs value="trending" onChange={vi.fn()} savedCount={3} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('savedCount=0: no badge on Saved tab', () => {
    const { container } = render(
      <FeedTabs value="trending" onChange={vi.fn()} savedCount={0} />,
    )
    // No badge spans should exist for 0 counts
    const savedTab = screen.getByRole('tab', { name: 'Saved' })
    expect(savedTab.querySelector('.glass-pill')).not.toBeInTheDocument()
  })

  it('blindspotCount=0: no badge on Blindspot tab', () => {
    render(<FeedTabs value="trending" onChange={vi.fn()} blindspotCount={0} />)
    const blindspotTab = screen.getByRole('tab', { name: 'Blindspot' })
    expect(blindspotTab.querySelector('.glass-pill')).not.toBeInTheDocument()
  })

  it('blindspotCount=2: badge "2" on Blindspot tab', () => {
    render(<FeedTabs value="trending" onChange={vi.fn()} blindspotCount={2} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('container has role="tablist"', () => {
    render(<FeedTabs value="trending" onChange={vi.fn()} />)
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })
})
