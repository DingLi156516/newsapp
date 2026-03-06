import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TopicPills } from '@/components/organisms/TopicPills'

vi.mock('framer-motion')

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
})
