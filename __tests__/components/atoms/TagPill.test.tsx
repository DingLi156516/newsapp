import { render, screen } from '@testing-library/react'
import { TagPill } from '@/components/atoms/TagPill'

describe('TagPill', () => {
  it('renders the tag label', () => {
    render(<TagPill label="Joe Biden" type="person" />)
    expect(screen.getByText('Joe Biden')).toBeInTheDocument()
  })

  it('shows tag type as title attribute', () => {
    render(<TagPill label="Google" type="organization" />)
    expect(screen.getByTitle('Organization')).toBeInTheDocument()
  })

  it('renders a colored dot for the tag type', () => {
    const { container } = render(<TagPill label="NYC" type="location" />)
    const dot = container.querySelector('.rounded-full')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveStyle({ backgroundColor: '#10B981' })
  })

  it('renders different colors for different tag types', () => {
    const { container: c1 } = render(<TagPill label="A" type="person" />)
    const { container: c2 } = render(<TagPill label="B" type="event" />)
    const dot1 = c1.querySelector('.rounded-full')
    const dot2 = c2.querySelector('.rounded-full')
    expect(dot1).toHaveStyle({ backgroundColor: '#8B5CF6' })
    expect(dot2).toHaveStyle({ backgroundColor: '#F59E0B' })
  })
})
