import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ViewSwitcher } from '@/components/organisms/ViewSwitcher'

vi.mock('framer-motion')

describe('ViewSwitcher', () => {
  it('renders Feed and Sources tab buttons', () => {
    render(<ViewSwitcher view="feed" onChange={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Sources' })).toBeInTheDocument()
  })

  it('Feed tab is aria-selected when view=feed', () => {
    render(<ViewSwitcher view="feed" onChange={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Feed' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Sources' })).toHaveAttribute('aria-selected', 'false')
  })

  it('Sources tab is aria-selected when view=sources', () => {
    render(<ViewSwitcher view="sources" onChange={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Sources' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Feed' })).toHaveAttribute('aria-selected', 'false')
  })

  it('clicking Sources calls onChange("sources")', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ViewSwitcher view="feed" onChange={onChange} />)
    await user.click(screen.getByRole('tab', { name: 'Sources' }))
    expect(onChange).toHaveBeenCalledWith('sources')
  })

  it('clicking Feed calls onChange("feed")', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ViewSwitcher view="sources" onChange={onChange} />)
    await user.click(screen.getByRole('tab', { name: 'Feed' }))
    expect(onChange).toHaveBeenCalledWith('feed')
  })

  it('has role="tablist" with aria-label="App view"', () => {
    render(<ViewSwitcher view="feed" onChange={vi.fn()} />)
    expect(screen.getByRole('tablist', { name: 'App view' })).toBeInTheDocument()
  })

  it('has correct data-testids', () => {
    render(<ViewSwitcher view="feed" onChange={vi.fn()} />)
    expect(screen.getByTestId('view-switcher')).toBeInTheDocument()
    expect(screen.getByTestId('view-tab-feed')).toBeInTheDocument()
    expect(screen.getByTestId('view-tab-sources')).toBeInTheDocument()
  })
})
